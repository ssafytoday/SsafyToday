import { log } from './util';

export const ToastType = {
  Danger: '#eb3b5a',
  Warning: '#fdcb6e',
  Success: '#00b894',
} as const;

export type ToastTypeValue = (typeof ToastType)[keyof typeof ToastType];

export class Toast {
  message: string;
  color: ToastTypeValue;
  time: number;
  element: HTMLDivElement | null;

  constructor(message: string, color: ToastTypeValue, time: number) {
    log('Constructor', message);
    this.message = message;
    this.color = color;
    this.time = time;
    this.element = null;

    const element = document.createElement('div');
    element.className = 'toast-notification';
    this.element = element;
    const countElements = document.getElementsByClassName('toast-notification');

    element.style.opacity = '0.8';
    element.style.marginBottom = `${countElements.length * 55}px`;
    element.style.backgroundColor = this.color;

    const messageElement = document.createElement('div');
    messageElement.className = 'message-container';
    messageElement.textContent = this.message;

    element.appendChild(messageElement);

    const close = document.createElement('div');
    close.className = 'close-notification';

    const icon = document.createElement('i');
    icon.className = 'lni lni-close';

    close.appendChild(icon);
    element.append(close);

    document.body.appendChild(element);

    setTimeout(() => {
      element.remove();
    }, this.time);

    element.addEventListener('click', () => {
      element.remove();
    });
    log('Closed');
  }

  static raiseToast(message: string, duration: number = 5000): Toast {
    return new Toast(message, ToastType.Danger, duration);
  }
}
