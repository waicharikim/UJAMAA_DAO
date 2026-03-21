"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "./auth-context"
import type { Notification, NotificationPreferences } from "@/lib/types"

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  preferences: NotificationPreferences | null
  markAsRead: (id: string) => void
  updatePreferences: (preferences: { channel: string; category: string; enabled: boolean }) => void
  isLoading: boolean
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiClient.getNotifications(),
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => apiClient.getNotificationPreferences(),
    enabled: isAuthenticated,
  })

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData(["notifications"], (old: Notification[] = []) =>
        old.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)),
      )
    },
  })

  const updatePreferencesMutation = useMutation({
    mutationFn: (prefs: { channel: string; category: string; enabled: boolean }) => apiClient.updateNotificationPreferences(prefs),
    onSuccess: (updatedPrefs) => {
      queryClient.setQueryData(["notification-preferences"], updatedPrefs)
    },
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = (id: string) => {
    markAsReadMutation.mutate(id)
  }

  const updatePreferences = (prefs: { channel: string; category: string; enabled: boolean }) => {
    updatePreferencesMutation.mutate(prefs)
  }

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        markAsRead,
        updatePreferences,
        isLoading: notificationsLoading || preferencesLoading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
