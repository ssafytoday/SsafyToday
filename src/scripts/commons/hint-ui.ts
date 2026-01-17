/**
 * AI Hint UI Components
 * - Floating hint button
 * - Chat modal/sidebar
 */
import log from "@/commons/logger";
import { Toast } from "@/commons/toast";
import {
  getHintWebSocket,
  type ProblemContext,
  type HintCallbacks,
} from "@/commons/hint-websocket";
import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import javascript from "highlight.js/lib/languages/javascript";

// Register highlight.js languages
hljs.registerLanguage("python", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", cpp);
hljs.registerLanguage("javascript", javascript);

// Configure marked with highlight.js
marked.use({
  breaks: true,
  gfm: true,
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted =
        language !== "plaintext"
          ? hljs.highlight(text, { language }).value
          : text;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
    },
  },
});

// Styles for hint UI (all properties use !important to override BaekjoonHub styles)
const HINT_STYLES = `
.ssafy-hint-btn {
  position: fixed !important;
  bottom: 80px !important;
  right: 20px !important;
  width: 56px !important;
  height: 56px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important;
  cursor: pointer !important;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.3s ease !important;
  z-index: 99999 !important;
}

.ssafy-hint-btn:hover {
  transform: scale(1.1) !important;
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6) !important;
}

.ssafy-hint-btn svg {
  width: 28px !important;
  height: 28px !important;
  fill: white !important;
}

.ssafy-hint-modal {
  position: fixed !important;
  /* Use left/top for easier resize calculations */
  left: auto !important;
  top: auto !important;
  right: 20px !important;
  bottom: 150px !important;
  /* width/height without !important to allow JS resizing */
  width: 450px;
  height: 550px;
  min-width: 350px !important;
  min-height: 400px !important;
  max-width: 90vw !important;
  max-height: 80vh !important;
  background: white !important;
  border-radius: 16px !important;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2) !important;
  display: none !important;
  flex-direction: column !important;
  z-index: 99998 !important;
  overflow: hidden !important;
}

.ssafy-hint-modal.visible {
  display: flex !important;
}

/* 8-direction resize handles */
.ssafy-hint-resize {
  position: absolute !important;
  z-index: 10 !important;
}

.ssafy-hint-resize-n {
  top: 0 !important;
  left: 12px !important;
  right: 12px !important;
  height: 6px !important;
  cursor: ns-resize !important;
}

.ssafy-hint-resize-s {
  bottom: 0 !important;
  left: 12px !important;
  right: 12px !important;
  height: 6px !important;
  cursor: ns-resize !important;
}

.ssafy-hint-resize-w {
  left: 0 !important;
  top: 12px !important;
  bottom: 12px !important;
  width: 6px !important;
  cursor: ew-resize !important;
}

.ssafy-hint-resize-e {
  right: 0 !important;
  top: 12px !important;
  bottom: 12px !important;
  width: 6px !important;
  cursor: ew-resize !important;
}

.ssafy-hint-resize-nw {
  top: 0 !important;
  left: 0 !important;
  width: 12px !important;
  height: 12px !important;
  cursor: nwse-resize !important;
}

.ssafy-hint-resize-ne {
  top: 0 !important;
  right: 0 !important;
  width: 12px !important;
  height: 12px !important;
  cursor: nesw-resize !important;
}

.ssafy-hint-resize-sw {
  bottom: 0 !important;
  left: 0 !important;
  width: 12px !important;
  height: 12px !important;
  cursor: nesw-resize !important;
}

.ssafy-hint-resize-se {
  bottom: 0 !important;
  right: 0 !important;
  width: 12px !important;
  height: 12px !important;
  cursor: nwse-resize !important;
}

/* Visual indicator for SE corner */
.ssafy-hint-resize-se::before {
  content: '' !important;
  position: absolute !important;
  right: 4px !important;
  bottom: 4px !important;
  width: 8px !important;
  height: 8px !important;
  border-right: 2px solid rgba(156, 163, 175, 0.8) !important;
  border-bottom: 2px solid rgba(156, 163, 175, 0.8) !important;
}

.ssafy-hint-resize-se:hover::before {
  border-color: rgba(107, 114, 128, 1) !important;
}

.ssafy-hint-header {
  padding: 16px 20px !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
}

.ssafy-hint-header h3 {
  margin: 0 !important;
  font-size: 16px !important;
  font-weight: 600 !important;
}

.ssafy-hint-close {
  background: none !important;
  border: none !important;
  color: white !important;
  cursor: pointer !important;
  font-size: 20px !important;
  padding: 0 !important;
  width: 28px !important;
  height: 28px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 50% !important;
  transition: background 0.2s !important;
}

.ssafy-hint-close:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

.ssafy-hint-messages {
  flex: 1 !important;
  overflow-y: auto !important;
  padding: 16px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  min-height: 100px !important;
}

.ssafy-hint-message {
  padding: 12px 16px !important;
  border-radius: 12px !important;
  max-width: 85% !important;
  line-height: 1.5 !important;
  font-size: 14px !important;
  word-wrap: break-word !important;
}

.ssafy-hint-message.user {
  white-space: pre-wrap !important;
  background: #667eea !important;
  color: white !important;
  margin-left: auto !important;
  border-bottom-right-radius: 4px !important;
}

.ssafy-hint-message.ai {
  background: #f3f4f6 !important;
  color: #1f2937 !important;
  margin-right: auto !important;
  border-bottom-left-radius: 4px !important;
}

.ssafy-hint-input-area {
  padding: 16px !important;
  border-top: 1px solid #e5e7eb !important;
  display: flex !important;
  gap: 8px !important;
}

.ssafy-hint-input {
  flex: 1 !important;
  padding: 12px 16px !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 24px !important;
  font-size: 14px !important;
  outline: none !important;
  transition: border-color 0.2s !important;
}

.ssafy-hint-input:focus {
  border-color: #667eea !important;
}

.ssafy-hint-send {
  width: 44px !important;
  height: 44px !important;
  border-radius: 50% !important;
  background: #667eea !important;
  border: none !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s !important;
}

.ssafy-hint-send:hover {
  background: #5a67d8 !important;
}

.ssafy-hint-send:disabled {
  background: #9ca3af !important;
  cursor: not-allowed !important;
}

.ssafy-hint-send svg {
  width: 20px !important;
  height: 20px !important;
  fill: white !important;
}

.ssafy-hint-typing {
  display: flex !important;
  gap: 4px !important;
  padding: 8px 12px !important;
}

.ssafy-hint-typing span {
  width: 8px !important;
  height: 8px !important;
  background: #9ca3af !important;
  border-radius: 50% !important;
  animation: ssafy-typing 1.4s infinite ease-in-out both !important;
}

.ssafy-hint-typing span:nth-child(1) { animation-delay: -0.32s !important; }
.ssafy-hint-typing span:nth-child(2) { animation-delay: -0.16s !important; }

@keyframes ssafy-typing {
  0%, 80%, 100% { transform: scale(0) !important; }
  40% { transform: scale(1) !important; }
}

.ssafy-hint-code-toggle {
  padding: 8px 16px !important;
  border-top: 1px solid #e5e7eb !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-size: 13px !important;
  color: #6b7280 !important;
}

.ssafy-hint-code-toggle input[type="checkbox"] {
  width: 16px !important;
  height: 16px !important;
  accent-color: #667eea !important;
}

/* Markdown rendering styles */
.ssafy-hint-message.ai code {
  background: #1e1e1e !important;
  color: #d4d4d4 !important;
  padding: 2px 6px !important;
  border-radius: 4px !important;
  font-family: 'Consolas', 'Monaco', monospace !important;
  font-size: 13px !important;
}

.ssafy-hint-message.ai pre {
  background: #1e1e1e !important;
  padding: 12px !important;
  border-radius: 8px !important;
  overflow-x: auto !important;
  margin: 8px 0 !important;
}

.ssafy-hint-message.ai pre code {
  padding: 0 !important;
  background: transparent !important;
  display: block !important;
  white-space: pre !important;
}

.ssafy-hint-message.ai ul,
.ssafy-hint-message.ai ol {
  margin: 8px 0 !important;
  padding-left: 20px !important;
}

.ssafy-hint-message.ai li {
  margin: 4px 0 !important;
}

.ssafy-hint-message.ai strong {
  font-weight: 600 !important;
}

.ssafy-hint-message.ai em {
  font-style: italic !important;
}

.ssafy-hint-message.ai p {
  margin: 4px 0 !important;
}

.ssafy-hint-message.ai p:first-child {
  margin-top: 0 !important;
}

.ssafy-hint-message.ai p:last-child {
  margin-bottom: 0 !important;
}

/* highlight.js theme (VS Code Dark+ style) */
.hljs { color: #d4d4d4 !important; }
.hljs-keyword { color: #569cd6 !important; }
.hljs-string { color: #ce9178 !important; }
.hljs-number { color: #b5cea8 !important; }
.hljs-comment { color: #6a9955 !important; font-style: italic !important; }
.hljs-function { color: #dcdcaa !important; }
.hljs-class { color: #4ec9b0 !important; }
.hljs-variable { color: #9cdcfe !important; }
.hljs-operator { color: #d4d4d4 !important; }
.hljs-punctuation { color: #d4d4d4 !important; }
.hljs-built_in { color: #4fc1ff !important; }
.hljs-type { color: #4ec9b0 !important; }
.hljs-params { color: #9cdcfe !important; }
.hljs-meta { color: #c586c0 !important; }
.hljs-title { color: #dcdcaa !important; }
.hljs-title.function_ { color: #dcdcaa !important; }
.hljs-title.class_ { color: #4ec9b0 !important; }
.hljs-attr { color: #9cdcfe !important; }
.hljs-attribute { color: #9cdcfe !important; }
.hljs-literal { color: #569cd6 !important; }
.hljs-regexp { color: #d16969 !important; }

/* Suggestions buttons */
.ssafy-hint-suggestions {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 8px !important;
  padding: 8px 16px 16px !important;
}

.ssafy-hint-suggestion {
  background: #e0e7ff !important;
  color: #4338ca !important;
  border: 1px solid #c7d2fe !important;
  border-radius: 16px !important;
  padding: 6px 12px !important;
  font-size: 13px !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
  text-align: left !important;
}

.ssafy-hint-suggestion:hover {
  background: #c7d2fe !important;
  border-color: #a5b4fc !important;
}
`;

// Icons
const HINT_ICON = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`;
const SEND_ICON = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const CLOSE_ICON = `×`;

// Default suggestions for initial message
const DEFAULT_SUGGESTIONS = [
  "이 문제를 어떻게 접근해야 할까요?",
  "입력과 출력 형식을 설명해주세요",
  "비슷한 예제를 들어주세요",
];

/**
 * HintUI class for managing hint interface
 */
export class HintUI {
  private container: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private suggestionsContainer: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private codeToggle: HTMLInputElement | null = null;
  private isVisible = false;
  private isStreaming = false;
  private currentAIMessage: HTMLElement | null = null;
  private problemContext: ProblemContext | null = null;
  private getCodeCallback: (() => string) | null = null;
  private rawContent = ""; // Raw markdown content for streaming

  /**
   * Initialize the hint UI
   */
  init(context: ProblemContext, getCode?: () => string): void {
    this.problemContext = context;
    this.getCodeCallback = getCode || null;

    this.injectStyles();
    this.createButton();
    this.createModal();

    log.info("Hint UI initialized for:", context.problem.title);
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    if (document.getElementById("ssafy-hint-styles")) return;

    const style = document.createElement("style");
    style.id = "ssafy-hint-styles";
    style.textContent = HINT_STYLES;
    document.head.appendChild(style);
  }

  /**
   * Create floating hint button
   */
  private createButton(): void {
    const btn = document.createElement("button");
    btn.className = "ssafy-hint-btn";
    btn.innerHTML = HINT_ICON;
    btn.title = "AI 힌트 받기";
    btn.addEventListener("click", () => this.toggleModal());

    document.body.appendChild(btn);
    this.container = btn;
  }

  /**
   * Create chat modal
   */
  private createModal(): void {
    const modal = document.createElement("div");
    modal.className = "ssafy-hint-modal";
    modal.innerHTML = `
      <!-- 8-direction resize handles -->
      <div class="ssafy-hint-resize ssafy-hint-resize-n" data-direction="n"></div>
      <div class="ssafy-hint-resize ssafy-hint-resize-s" data-direction="s"></div>
      <div class="ssafy-hint-resize ssafy-hint-resize-w" data-direction="w"></div>
      <div class="ssafy-hint-resize ssafy-hint-resize-e" data-direction="e"></div>
      <div class="ssafy-hint-resize ssafy-hint-resize-nw" data-direction="nw"></div>
      <div class="ssafy-hint-resize ssafy-hint-resize-ne" data-direction="ne"></div>
      <div class="ssafy-hint-resize ssafy-hint-resize-sw" data-direction="sw"></div>
      <div class="ssafy-hint-resize ssafy-hint-resize-se" data-direction="se"></div>
      <div class="ssafy-hint-header">
        <h3>AI 힌트</h3>
        <button class="ssafy-hint-close">${CLOSE_ICON}</button>
      </div>
      <div class="ssafy-hint-messages">
        <div class="ssafy-hint-message ai">안녕하세요! "${this.problemContext?.problem.title}" 문제에 대해 도움이 필요하시면 질문해주세요. 직접적인 답은 드리지 않지만, 올바른 방향으로 안내해드릴게요.</div>
      </div>
      <div class="ssafy-hint-suggestions"></div>
      <div class="ssafy-hint-code-toggle">
        <input type="checkbox" id="ssafy-include-code" checked />
        <label for="ssafy-include-code">현재 코드 포함하기</label>
      </div>
      <div class="ssafy-hint-input-area">
        <input type="text" class="ssafy-hint-input" placeholder="질문을 입력하세요..." />
        <button class="ssafy-hint-send">${SEND_ICON}</button>
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;

    // Get references
    this.messagesContainer = modal.querySelector(".ssafy-hint-messages");
    this.suggestionsContainer = modal.querySelector(".ssafy-hint-suggestions");
    this.input = modal.querySelector(".ssafy-hint-input");
    this.sendButton = modal.querySelector(".ssafy-hint-send");
    this.codeToggle = modal.querySelector("#ssafy-include-code");

    // Show default suggestions
    this.showSuggestions(DEFAULT_SUGGESTIONS);

    // Event listeners
    modal
      .querySelector(".ssafy-hint-close")
      ?.addEventListener("click", () => this.hideModal());
    this.input?.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.sendButton?.addEventListener("click", () => this.sendMessage());

    // Initialize resize handles and restore saved size
    this.initResizeHandles(modal);
    this.restoreModalSize(modal);
  }

  /**
   * Get storage key for current platform
   */
  private getStorageKey(): string {
    const platform = this.problemContext?.platform || "default";
    return `ssafy-hint-modal-size-${platform}`;
  }

  /**
   * Save modal size to localStorage
   */
  private saveModalSize(width: number, height: number): void {
    try {
      const key = this.getStorageKey();
      localStorage.setItem(key, JSON.stringify({ width, height }));
      log.debug(`Saved modal size for ${this.problemContext?.platform}: ${width}x${height}`);
    } catch (e) {
      log.warn("Failed to save modal size:", e);
    }
  }

  /**
   * Restore modal size from localStorage
   */
  private restoreModalSize(modal: HTMLElement): void {
    try {
      const key = this.getStorageKey();
      const saved = localStorage.getItem(key);
      if (saved) {
        const { width, height } = JSON.parse(saved);
        const minWidth = 350;
        const minHeight = 400;
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.8;

        // Validate and apply saved size
        const validWidth = Math.max(minWidth, Math.min(maxWidth, width));
        const validHeight = Math.max(minHeight, Math.min(maxHeight, height));

        modal.style.width = `${validWidth}px`;
        modal.style.height = `${validHeight}px`;
        log.debug(`Restored modal size for ${this.problemContext?.platform}: ${validWidth}x${validHeight}`);
      }
    } catch (e) {
      log.warn("Failed to restore modal size:", e);
    }
  }

  /**
   * Initialize 8-direction resize handles
   */
  private initResizeHandles(modal: HTMLElement): void {
    const handles = modal.querySelectorAll(".ssafy-hint-resize");
    if (handles.length === 0) return;

    let isResizing = false;
    let currentDirection = "";
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMouseDown = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as HTMLElement;
      currentDirection = target.dataset.direction || "";

      if (!currentDirection) return;

      isResizing = true;
      startX = mouseEvent.clientX;
      startY = mouseEvent.clientY;

      const rect = modal.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      startLeft = rect.left;
      startTop = rect.top;

      // Convert to left/top positioning during resize
      modal.style.right = "auto";
      modal.style.bottom = "auto";
      modal.style.left = `${startLeft}px`;
      modal.style.top = `${startTop}px`;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Constraints
      const minWidth = 350;
      const minHeight = 400;
      const maxWidth = window.innerWidth * 0.9;
      const maxHeight = window.innerHeight * 0.8;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      // Calculate based on direction
      const dir = currentDirection;

      // Width changes (e, w, ne, nw, se, sw)
      if (dir.includes("e")) {
        // Expanding right: width increases with positive deltaX
        newWidth = startWidth + deltaX;
      }
      if (dir.includes("w")) {
        // Expanding left: width increases with negative deltaX, left decreases
        newWidth = startWidth - deltaX;
        newLeft = startLeft + deltaX;
      }

      // Height changes (n, s, ne, nw, se, sw)
      if (dir.includes("s")) {
        // Expanding down: height increases with positive deltaY
        newHeight = startHeight + deltaY;
      }
      if (dir.includes("n")) {
        // Expanding up: height increases with negative deltaY, top decreases
        newHeight = startHeight - deltaY;
        newTop = startTop + deltaY;
      }

      // Apply constraints
      if (newWidth < minWidth) {
        if (dir.includes("w")) {
          newLeft = startLeft + startWidth - minWidth;
        }
        newWidth = minWidth;
      }
      if (newWidth > maxWidth) {
        if (dir.includes("w")) {
          newLeft = startLeft + startWidth - maxWidth;
        }
        newWidth = maxWidth;
      }
      if (newHeight < minHeight) {
        if (dir.includes("n")) {
          newTop = startTop + startHeight - minHeight;
        }
        newHeight = minHeight;
      }
      if (newHeight > maxHeight) {
        if (dir.includes("n")) {
          newTop = startTop + startHeight - maxHeight;
        }
        newHeight = maxHeight;
      }

      // Prevent going off screen
      if (newLeft < 0) {
        newWidth = startWidth + startLeft;
        newLeft = 0;
      }
      if (newTop < 0) {
        newHeight = startHeight + startTop;
        newTop = 0;
      }

      // Apply new dimensions and position
      modal.style.width = `${newWidth}px`;
      modal.style.height = `${newHeight}px`;
      modal.style.left = `${newLeft}px`;
      modal.style.top = `${newTop}px`;
    };

    const onMouseUp = () => {
      if (isResizing) {
        // Save the final size
        this.saveModalSize(modal.offsetWidth, modal.offsetHeight);

        // Keep using left/top positioning (don't revert to right/bottom)
        // This prevents jumps after resize
      }

      isResizing = false;
      currentDirection = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    handles.forEach((handle) => {
      handle.addEventListener("mousedown", onMouseDown);
    });
  }

  /**
   * Toggle modal visibility
   */
  toggleModal(): void {
    if (this.isVisible) {
      this.hideModal();
    } else {
      this.showModal();
    }
  }

  /**
   * Show modal and initialize hint service
   */
  async showModal(): Promise<void> {
    if (!this.modal || !this.problemContext) return;

    this.modal.classList.add("visible");
    this.isVisible = true;

    // Initialize hint service if not ready
    const ws = getHintWebSocket();
    if (!ws.isReady()) {
      const callbacks: HintCallbacks = {
        onReady: () => {
          Toast.success("AI 힌트 준비 완료!", 1500);
        },
        onStart: () => {
          this.isStreaming = true;
          this.rawContent = "";
          this.currentAIMessage = this.addMessage("", false);
          this.addTypingIndicator();
        },
        onChunk: (content) => {
          this.removeTypingIndicator();
          if (this.currentAIMessage) {
            this.rawContent += content;
            // Remove [SUGGESTIONS] and everything after it for display
            const displayContent = this.rawContent.replace(/\[SUGGESTIONS\][\s\S]*$/i, "").trim();
            this.currentAIMessage.innerHTML = marked.parse(displayContent) as string;
            this.scrollToBottom();
          }
        },
        onDone: () => {
          this.isStreaming = false;
          this.currentAIMessage = null;
          this.removeTypingIndicator();
          this.enableInput();
        },
        onError: (error) => {
          this.isStreaming = false;
          this.removeTypingIndicator();
          this.enableInput();
          Toast.danger(error, 4000);
        },
        onDisconnect: () => {
          // Not used in HTTP mode
        },
        onSuggestions: (suggestions) => {
          this.showSuggestions(suggestions);
        },
      };

      await ws.connect(this.problemContext, callbacks);
    }

    this.input?.focus();
  }

  /**
   * Hide modal
   */
  hideModal(): void {
    if (!this.modal) return;

    this.modal.classList.remove("visible");
    this.isVisible = false;
  }

  /**
   * Send message
   */
  private sendMessage(): void {
    if (!this.input || this.isStreaming) return;

    const content = this.input.value.trim();
    if (!content) return;

    // Get current code if toggle is checked
    const includeCode = this.codeToggle?.checked ?? true;
    const code = includeCode ? this.getCodeCallback?.() || "" : "";

    // Clear previous suggestions
    this.clearSuggestions();

    // Add user message to UI
    this.addMessage(content, true);
    this.input.value = "";

    // Send via WebSocket
    const ws = getHintWebSocket();
    if (ws.isReady()) {
      this.disableInput();
      ws.sendMessage(content, code);
    } else {
      Toast.danger("연결이 끊어졌습니다. 모달을 다시 열어주세요.", 3000);
    }
  }

  /**
   * Add message to chat
   */
  private addMessage(content: string, isUser: boolean): HTMLElement {
    const msg = document.createElement("div");
    msg.className = `ssafy-hint-message ${isUser ? "user" : "ai"}`;
    msg.textContent = content;

    this.messagesContainer?.appendChild(msg);
    this.scrollToBottom();

    return msg;
  }

  /**
   * Add typing indicator
   */
  private addTypingIndicator(): void {
    const typing = document.createElement("div");
    typing.className = "ssafy-hint-typing";
    typing.id = "ssafy-hint-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    this.messagesContainer?.appendChild(typing);
    this.scrollToBottom();
  }

  /**
   * Remove typing indicator
   */
  private removeTypingIndicator(): void {
    document.getElementById("ssafy-hint-typing")?.remove();
  }

  /**
   * Scroll messages to bottom
   */
  private scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }

  /**
   * Disable input while waiting for response
   */
  private disableInput(): void {
    if (this.input) this.input.disabled = true;
    if (this.sendButton) this.sendButton.disabled = true;
  }

  /**
   * Enable input after response
   */
  private enableInput(): void {
    if (this.input) this.input.disabled = false;
    if (this.sendButton) this.sendButton.disabled = false;
    this.input?.focus();
  }

  /**
   * Show suggestion buttons
   */
  private showSuggestions(suggestions: string[]): void {
    if (!this.suggestionsContainer) return;

    this.suggestionsContainer.innerHTML = suggestions
      .map((s) => `<button class="ssafy-hint-suggestion">${s}</button>`)
      .join("");

    // Bind click events
    this.suggestionsContainer
      .querySelectorAll(".ssafy-hint-suggestion")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const question = btn.textContent || "";
          if (this.input) {
            this.input.value = question;
            this.sendMessage();
          }
        });
      });
  }

  /**
   * Clear suggestion buttons
   */
  private clearSuggestions(): void {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.innerHTML = "";
    }
  }

  /**
   * Cleanup and remove UI
   */
  destroy(): void {
    getHintWebSocket().disconnect();
    this.container?.remove();
    this.modal?.remove();
    document.getElementById("ssafy-hint-styles")?.remove();
  }
}

/**
 * Factory function to create and initialize HintUI
 */
export function createHintUI(
  context: ProblemContext,
  getCode?: () => string
): HintUI {
  const ui = new HintUI();
  ui.init(context, getCode);
  return ui;
}
