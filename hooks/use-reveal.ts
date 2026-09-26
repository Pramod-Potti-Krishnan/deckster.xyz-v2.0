"use client"

import { useEffect } from "react"

export function useReveal() {
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(".mv3 main > section.slide")
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-in")
      }),
      { threshold: 0.2 },
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])
}
