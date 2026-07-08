"use client";
import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

interface UserInfo {
  id: number;
  email: string;
  full_name: string;
  is_superuser: boolean;
  roles: { id: number; name: string; description: string }[];
}

interface UseUserPermissionsResult {
  permissions: string[];
  user: UserInfo | null;
  loading: boolean;
  error: string | null;
  can: (permission: string) => boolean;
  isAdmin: boolean;
  refresh: () => void;
}

export function useUserPermissions(): UseUserPermissionsResult {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userInfo, permData] = await Promise.all([
        auth.me(),
        auth.myPermissions(),
      ]);
      setUser(userInfo);
      setPermissions(permData.permissions);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (permission: string) => {
      if (user?.is_superuser) return true;
      return hasPermission(permissions, permission);
    },
    [permissions, user]
  );

  return {
    permissions,
    user,
    loading,
    error,
    can,
    isAdmin: user?.is_superuser || permissions.includes("user:admin"),
    refresh: load,
  };
}
