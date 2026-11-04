// FRONTEND-1 (Pass 5 author lane F-1, flag NEXT_PUBLIC_STUDIO_AUTHOR_PICKER). The Standard / Author segmented choice on the outline approval.
// Renders nothing unless lib/studio-author-picker.ts says it is visible (flag on AND a verified signed premium/internal claim).
"use client"
import React, { useState } from "react"
import { authorPickerFlagOn, authorPickerVisible, getAuthorBuildChoice, setAuthorBuildChoice, signedAuthorTierClaim, type AuthorBuildChoice } from "@/lib/studio-author-picker"

export function AuthorBuildPicker() {
  const visible = authorPickerVisible(authorPickerFlagOn(), signedAuthorTierClaim())
  const [value, setValue] = useState<AuthorBuildChoice>(() => getAuthorBuildChoice())
  if (!visible) return null
  const pick = (next: AuthorBuildChoice) => setValue(setAuthorBuildChoice(next, visible))
  return (
    <div role="radiogroup" aria-label="Build mode" data-studio-author-picker="true" className="inline-flex rounded-md border border-gray-200 dark:border-slate-700 text-xs overflow-hidden">
      {(["standard", "author"] as const).map(option => (
        <button key={option} type="button" role="radio" aria-checked={value === option} onClick={() => pick(option)}
          className={value === option ? "px-2.5 py-1 bg-gray-900 text-white dark:bg-slate-600" : "px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-slate-800"}>
          {option === "standard" ? "Standard" : "Author"}
        </button>
      ))}
    </div>
  )
}
