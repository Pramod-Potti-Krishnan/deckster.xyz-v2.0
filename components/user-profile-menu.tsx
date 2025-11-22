"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  User,
  Settings,
  CreditCard,
  Moon,
  Sun,
  Keyboard,
  HelpCircle,
  LogOut,
  Crown,
} from "lucide-react"
import { useTheme } from "next-themes"

export function UserProfileMenu() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  if (isLoading || !user) {
    return (
      <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
    )
  }

  const userInitials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  const handleNavigation = (path: string) => {
    router.push(path)
    setIsOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    setIsOpen(false)
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
        >
          <Avatar className="h-10 w-10 border-2 border-gray-200 dark:border-gray-700">
            <AvatarImage
              src={user.image || undefined}
              alt={user.name || "User avatar"}
            />
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleNavigation("/profile")}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation("/settings/account")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Account Settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation("/billing")}>
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Billing & Subscription</span>
          {user.tier === "free" && (
            <Badge variant="secondary" className="ml-auto text-xs">
              Upgrade
            </Badge>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={toggleTheme}>
          {theme === "dark" ? (
            <>
              <Sun className="mr-2 h-4 w-4" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="mr-2 h-4 w-4" />
              <span>Dark Mode</span>
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation("/shortcuts")}>
          <Keyboard className="mr-2 h-4 w-4" />
          <span>Keyboard Shortcuts</span>
          <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation("/help")}>
          <HelpCircle className="mr-2 h-4 w-4" />
          <span>Help & Support</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}