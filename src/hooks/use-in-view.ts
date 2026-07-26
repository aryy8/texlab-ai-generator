import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * True while the element intersects the viewport.
 * Used to defer landing mockup motion until the user scrolls to it.
 */
export function useInView<T extends Element = HTMLElement>(
  options?: IntersectionObserverInit,
): { ref: RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      {
        threshold: 0.28,
        rootMargin: "0px 0px -8% 0px",
        ...options,
      },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, inView };
}
