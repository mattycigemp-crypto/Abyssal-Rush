import { useEffect, useRef } from "react";

export type Keys = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
  boost: boolean;
  reset: boolean;
};

export function useKeyboard() {
  const keys = useRef<Keys>({
    forward: false,
    back: false,
    left: false,
    right: false,
    brake: false,
    boost: false,
    reset: false,
  });

  useEffect(() => {
    const map = (code: string, down: boolean) => {
      const k = keys.current;
      switch (code) {
        case "KeyW":
        case "ArrowUp":
          k.forward = down;
          break;
        case "KeyS":
        case "ArrowDown":
          k.back = down;
          break;
        case "KeyA":
        case "ArrowLeft":
          k.left = down;
          break;
        case "KeyD":
        case "ArrowRight":
          k.right = down;
          break;
        case "Space":
          k.brake = down;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          k.boost = down;
          break;
        case "KeyR":
          k.reset = down;
          break;
      }
    };
    const onDown = (e: KeyboardEvent) => map(e.code, true);
    const onUp = (e: KeyboardEvent) => map(e.code, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  return keys;
}
