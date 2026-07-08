"use client";
import { useUserPermissions } from "@/lib/hooks/useUserPermissions";

interface PermissionGateProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { can, loading } = useUserPermissions();
  if (loading) return null;
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
