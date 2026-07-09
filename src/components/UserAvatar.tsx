import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/initials";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-2xl",
} as const;

interface UserAvatarProps {
  fullName?: string | null;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function UserAvatar({ fullName, avatarUrl, size = "md", className }: UserAvatarProps) {
  const initials = getInitials(fullName ?? "");

  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Avatar"} />}
      <AvatarFallback className="bg-[#1D9E75]/25 font-bold text-[#1D9E75]">
        {initials || <User className="h-1/2 w-1/2" strokeWidth={1.75} />}
      </AvatarFallback>
    </Avatar>
  );
}
