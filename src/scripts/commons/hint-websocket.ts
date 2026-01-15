/**
 * Local LLM HTTP API service for AI hint functionality
 * Uses ssafy.today/ssafytoday/v1/ endpoint (nginx proxy to llama.cpp)
 */
import log from "@/commons/logger";

// Local LLM API endpoint (via nginx proxy)
const LLM_API_URL = "https://ssafy.today/ssafytoday/v1/chat/completions";
const LLM_MODEL = "qwen2.5-coder-14b-instruct-q4_k_m.gguf";
const LLM_MAX_TOKENS = 2000;
const LLM_TEMPERATURE = 0.7;
const LLM_TIMEOUT = 120000; // 2 minutes

// Socratic teaching system prompt
const HINT_SYSTEM_PROMPT = `### Role Definition
당신은 학생의 사고력을 키워주는 **'알고리즘 소크라테스 멘토'**입니다. 정답을 주는 대신, 질문을 통해 학생이 스스로 답을 찾도록 유도하는 것이 당신의 존재 목적입니다.

### Operational Rules (엄격 준수)
1. **Language & Stack**:
   - 학생이 언어를 명시하지 않으면 무조건 **Java**를 기준으로 설명합니다.
   - 모든 답변은 **한국어**로 작성합니다.

2. **Negative Constraints (절대 금지 - 위반 시 시스템 오류 간주)**:
   - 🚫 **정답 코드 제공 금지**: 전체 코드는 물론, 핵심 로직이 담긴 코드 조각도 제공하지 않습니다.
   - 🚫 **알고리즘/자료구조 직접 언급 금지**: "DP를 쓰세요", "BFS 문제입니다", "스택이 필요해요" 등의 직접적인 키워드를 말하지 마세요. 대신 "먼저 들어간 것이 나중에 나오는 구조인가요?", "모든 경로를 다 탐색해야 할까요?"와 같이 풀어서 설명하세요.
   - 🚫 **복잡도 힌트 금지**: Big-O 표기법(O(N))을 직접 말하지 마세요.

3. **Guideline (소크라테스식 교수법)**:
   - 학생의 현재 이해도를 파악하기 위한 **역질문**을 던지세요.
   - 입력값이 작을 때(Edge case)를 손으로 써보게 유도하세요.
   - 논리적 오류가 있다면 그 부분만 짚어서 "이 경우엔 어떤 결과가 나올까요?"라고 물어보세요.

### Output Format (출력 형식 - 변경 불가)
당신의 모든 응답은 반드시 아래의 포맷을 따라야 합니다. 이 때에 "[SUGGESTIONS]"을 포함한 후속질문을 포함하여 다른 말로 시작하거나 끝내지 마세요.

---
(여기에 학생의 질문에 대한 가이드, 개념 설명, 역질문 내용을 충실하게 작성하세요. 중간에 끊지 말고 충분히 설명해야 합니다.)

[SUGGESTIONS]
- (현재 단계에서 학생이 고민해봐야 할 핵심 질문 1)
- (학생의 논리를 검증하거나 힌트가 될 만한 질문 2)
- (문제의 제약 조건이나 엣지 케이스를 상기시키는 질문 3)
---

### Example Scenario
**User**: "이거 자꾸 시간 초과 나는데 왜 이래요? 코드 좀 봐주세요."
**Assistant**: 공유해주신 로직을 보면 이중 반복문을 사용하고 있네요. 문제의 입력 크기(N)가 최대 100,000이라면, 이중 반복문을 돌 때 연산 횟수가 대략 얼마나 될까요? 우리가 제한 시간 내에 처리해야 하는 연산 횟수와 비교해보면 원인을 알 수 있을 것 같아요.

[SUGGESTIONS]
- 입력 N이 100,000일 때 N의 제곱은 얼마가 될까요?
- 데이터를 꼭 두 번 훑어야만 답을 구할 수 있을까요? 한 번만 훑으면서 처리할 방법은 없을까요?
- Java에서 Scanner 대신 더 빠른 입출력 방식을 알고 있나요?`;

// Problem context to send
export interface ProblemContext {
  platform: "baekjoon" | "programmers" | "swea";
  problem: {
    id: string;
    title: string;
    level: string;
    description: string;
    tags?: string[];
  };
}

// Message format for conversation
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Callback types
export interface HintCallbacks {
  onReady?: () => void;
  onStart?: () => void;
  onChunk?: (content: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
  onDisconnect?: () => void;
  onSuggestions?: (suggestions: string[]) => void;
}

/**
 * HintService class for managing AI hints via HTTP API
 */
export class HintWebSocket {
  private problemContext: ProblemContext | null = null;
  private callbacks: HintCallbacks = {};
  private conversationHistory: ChatMessage[] = [];
  private isInitialized = false;
  private maxHistory = 10;

  /**
   * Initialize with problem context (replaces WebSocket connect)
   */
  async connect(
    context: ProblemContext,
    callbacks: HintCallbacks
  ): Promise<boolean> {
    this.problemContext = context;
    this.callbacks = callbacks;
    this.conversationHistory = [];
    this.isInitialized = true;

    log.info("Hint service initialized for:", context.problem.title);

    // Notify ready immediately (no connection needed)
    setTimeout(() => {
      this.callbacks.onReady?.();
    }, 100);

    return true;
  }

  /**
   * Build system prompt with problem context
   */
  private buildSystemPrompt(currentCode?: string): string {
    if (!this.problemContext) {
      return HINT_SYSTEM_PROMPT;
    }

    const { problem, platform } = this.problemContext;
    let codeSection = "";
    if (currentCode && currentCode.trim()) {
      codeSection = `\n\n## 학생이 작성 중인 코드\n\`\`\`\n${currentCode.slice(0, 5000)}\n\`\`\``;
    }

    return `${HINT_SYSTEM_PROMPT}

## 문제 정보 (플랫폼: ${platform})
- 제목: ${problem.title}
- 문제 ID: ${problem.id}
- 난이도: ${problem.level}
- 설명:
${problem.description.slice(0, 3000)}${codeSection}`;
  }

  /**
   * Send a message and get streaming response
   */
  sendMessage(content: string, code?: string): boolean {
    if (!this.isInitialized || !this.problemContext) {
      log.warn("Hint service not initialized");
      return false;
    }

    // Add user message to history
    this.conversationHistory.push({
      role: "user",
      content: content,
    });

    // Trim history if too long
    if (this.conversationHistory.length > this.maxHistory * 2) {
      this.conversationHistory = this.conversationHistory.slice(
        -this.maxHistory * 2
      );
    }

    // Build messages array
    const messages: ChatMessage[] = [
      { role: "system", content: this.buildSystemPrompt(code) },
      ...this.conversationHistory,
    ];

    // Start streaming request
    this.streamCompletion(messages);

    return true;
  }

  /**
   * Stream chat completion from LLM API
   */
  private async streamCompletion(messages: ChatMessage[]): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT);

    let fullResponse = "";

    try {
      this.callbacks.onStart?.();

      const response = await fetch(LLM_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: messages,
          max_tokens: LLM_MAX_TOKENS,
          temperature: LLM_TEMPERATURE,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              // Parse suggestions from response
              const { content, suggestions } =
                this.parseSuggestions(fullResponse);

              // Add assistant response to history (without suggestions)
              this.conversationHistory.push({
                role: "assistant",
                content: content,
              });

              this.callbacks.onDone?.();

              // Send suggestions if found
              if (suggestions.length > 0) {
                this.callbacks.onSuggestions?.(suggestions);
              }
              return;
            }

            try {
              const json = JSON.parse(data);
              const chunk = json.choices?.[0]?.delta?.content;
              if (chunk) {
                fullResponse += chunk;
                this.callbacks.onChunk?.(chunk);
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }

      // If we get here without [DONE], still save the response
      if (fullResponse) {
        const { content, suggestions } = this.parseSuggestions(fullResponse);
        this.conversationHistory.push({
          role: "assistant",
          content: content,
        });

        this.callbacks.onDone?.();

        if (suggestions.length > 0) {
          this.callbacks.onSuggestions?.(suggestions);
        }
      } else {
        this.callbacks.onDone?.();
      }
    } catch (error) {
      // Remove failed user message from history
      this.conversationHistory.pop();

      if (error instanceof Error && error.name === "AbortError") {
        this.callbacks.onError?.("요청 시간이 초과되었습니다.");
      } else {
        this.callbacks.onError?.((error as Error).message || "알 수 없는 오류");
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse suggestions from AI response
   */
  private parseSuggestions(response: string): {
    content: string;
    suggestions: string[];
  } {
    const suggestionsMatch = response.match(/\[SUGGESTIONS\]\s*([\s\S]*?)$/i);
    if (!suggestionsMatch) {
      return { content: response.trim(), suggestions: [] };
    }

    const suggestions = suggestionsMatch[1]
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 3);

    const content = response.replace(/\[SUGGESTIONS\][\s\S]*$/i, "").trim();

    return { content, suggestions };
  }

  /**
   * Check if ready to send messages
   */
  isReady(): boolean {
    return this.isInitialized && this.problemContext !== null;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.isInitialized = false;
    this.problemContext = null;
    this.conversationHistory = [];
    this.callbacks = {};
  }
}

// Singleton instance
let hintWebSocketInstance: HintWebSocket | null = null;

export function getHintWebSocket(): HintWebSocket {
  if (!hintWebSocketInstance) {
    hintWebSocketInstance = new HintWebSocket();
  }
  return hintWebSocketInstance;
}
