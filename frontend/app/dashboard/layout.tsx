"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogoFull } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  MessageSquare,
  Settings,
  LogOut,
  Clock,
  Briefcase,
  Bell,
  ChevronDown,
  AlertCircle,
  Check,
  Trash2,
  MessageCircle,
  CreditCard,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { subscriptionAPI, tokenManager } from "@/lib/api";
import { NotificationProvider, useNotifications, Notification } from "@/lib/notification-context";

const sidebarLinks = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/doctors",
    label: "Doctors",
    icon: Stethoscope,
  },
  {
    href: "/dashboard/services",
    label: "Services",
    icon: Briefcase,
  },
  {
    href: "/dashboard/schedules",
    label: "Schedules",
    icon: Clock,
  },
  {
    href: "/dashboard/appointments",
    label: "Appointments",
    icon: Calendar,
  },
  {
    href: "/dashboard/patients",
    label: "Patients",
    icon: Users,
  },
  {
    href: "/dashboard/messages",
    label: "Messages",
    icon: MessageSquare,
  },
  {
    href: "/dashboard/chats",
    label: "Live Chat",
    icon: MessageCircle,
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: CreditCard,
  },
];

const bottomLinks = [
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
  },
];

interface UserInfo {
  id: string;
  hospitalId?: string;
  userType: string;
  name?: string;
  email?: string;
  username?: string;
  needsOnboarding?: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Check authentication and user info
    const checkAuth = () => {
      const token = tokenManager.getToken();
      const user = localStorage.getItem("userInfo");

      if (!token || !user) {
        router.push("/login");
        return;
      }

      try {
        const userData: UserInfo = JSON.parse(user);
        
        // Redirect super admins to their dashboard
        if (userData.userType === "website_admin") {
          router.push("/super-admin");
          return;
        }

        setUserInfo(userData);

        // Check if hospital admin needs onboarding (first login)
        if (
          userData.userType === "hospital_admin" &&
          !userData.name &&
          pathname !== "/dashboard/onboarding"
        ) {
          setNeedsOnboarding(true);
          router.push("/dashboard/onboarding");
        }
      } catch (error) {
        console.error("Error parsing user info:", error);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, pathname]);

  const handleLogout = () => {
    tokenManager.removeToken();
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  const displayName = userInfo?.name || userInfo?.username || "User";
  const displayEmail = userInfo?.email || "user@hospital.com";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <NotificationProvider>
      <DashboardContent
        pathname={pathname}
        hospitalId={userInfo?.hospitalId || userInfo?.id || ""}
        displayName={displayName}
        displayEmail={displayEmail}
        initials={initials}
        needsOnboarding={needsOnboarding}
        handleLogout={handleLogout}
      >
        {children}
      </DashboardContent>
    </NotificationProvider>
  );
}

// Notification Bell Component
function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "appointment":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "message":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.link || "#"}
                  onClick={() => {
                    markAsRead(notification.id);
                    setIsOpen(false);
                  }}
                  className={`flex gap-3 p-4 hover:bg-secondary/50 transition-colors ${
                    !notification.read ? "bg-blue-50/50" : ""
                  }`}
                >
                  <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${!notification.read ? "font-semibold" : ""}`}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <Badge variant="default" className="bg-blue-500 text-[10px] px-1 py-0 h-4 flex-shrink-0">
                          NEW
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {formatTime(notification.timestamp)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={clearNotifications}>
              <Trash2 className="h-3 w-3 mr-1" />
              Clear all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Dashboard Content Component (needs to be inside NotificationProvider)
function DashboardContent({
  pathname,
  hospitalId,
  displayName,
  displayEmail,
  initials,
  needsOnboarding,
  handleLogout,
  children,
}: {
  pathname: string;
  hospitalId: string;
  displayName: string;
  displayEmail: string;
  initials: string;
  needsOnboarding: boolean;
  handleLogout: () => void;
  children: React.ReactNode;
}) {
  const { pendingAppointmentsCount, waitingChatsCount } = useNotifications();
  const [subscriptionNotice, setSubscriptionNotice] = useState<
    | {
        type: "trial" | "blocked";
        message: string;
      }
    | null
  >(null);

  useEffect(() => {
    const loadSubscriptionNotice = async () => {
      if (!hospitalId || pathname.startsWith("/dashboard/billing")) {
        setSubscriptionNotice(null);
        return;
      }

      try {
        const response = await subscriptionAPI.getSubscriptionDetails(hospitalId);
        const details = response.data as {
          hasAccess?: boolean;
          isTrialActive?: boolean;
          trialEndDate?: string | null;
        };

        if (details?.hasAccess === false) {
          setSubscriptionNotice({
            type: "blocked",
            message: "Subscription is required to continue using dashboard features.",
          });
          return;
        }

        if (details?.isTrialActive && details?.trialEndDate) {
          const end = new Date(details.trialEndDate).getTime();
          const daysLeft = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysLeft >= 0) {
            setSubscriptionNotice({
              type: "trial",
              message:
                daysLeft > 0
                  ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your trial. Upgrade any time to avoid interruption.`
                  : "Your trial ends today. Upgrade now to avoid interruption.",
            });
            return;
          }
        }

        setSubscriptionNotice(null);
      } catch {
        setSubscriptionNotice(null);
      }
    };

    loadSubscriptionNotice();
  }, [hospitalId, pathname]);

  return (
    <div className="min-h-screen flex bg-secondary">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-border flex flex-col fixed h-full">
        <div className="p-4 border-b border-border">
          <Link href="/dashboard">
            <LogoFull />
          </Link>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Main Menu
          </p>
          <ul className="space-y-1">
            {sidebarLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/dashboard" && pathname.startsWith(link.href));
              const showBadge = link.href === "/dashboard/appointments" && pendingAppointmentsCount > 0;
              const showChatBadge = link.href === "/dashboard/chats" && waitingChatsCount > 0;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <link.icon className="w-5 h-5" />
                      {link.label}
                    </span>
                    {showBadge && (
                      <Badge 
                        variant={isActive ? "secondary" : "default"} 
                        className={`${isActive ? "bg-white text-primary" : "bg-red-500"} text-xs px-1.5 py-0.5 min-w-[20px] flex items-center justify-center`}
                      >
                        {pendingAppointmentsCount > 99 ? "99+" : pendingAppointmentsCount}
                      </Badge>
                    )}
                    {showChatBadge && (
                      <Badge 
                        variant={isActive ? "secondary" : "default"} 
                        className={`${isActive ? "bg-white text-primary" : "bg-amber-500 animate-pulse"} text-xs px-1.5 py-0.5 min-w-[20px] flex items-center justify-center`}
                      >
                        {waitingChatsCount > 99 ? "99+" : waitingChatsCount}
                      </Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <Separator className="my-4" />

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Settings
          </p>
          <ul className="space-y-1">
            {bottomLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <link.icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10 bg-primary text-white">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {displayEmail}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Top Header */}
        <header className="bg-white border-b border-border sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">
                {sidebarLinks.find(
                  (l) =>
                    l.href === pathname ||
                    (l.href !== "/dashboard" && pathname.startsWith(l.href)),
                )?.label ||
                  bottomLinks.find((l) => l.href === pathname)?.label ||
                  "Dashboard"}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <Avatar className="h-8 w-8 bg-primary text-white">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary text-white">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline">{displayName}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>
                    <Link href="/dashboard/settings" className="flex w-full">
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Onboarding Alert */}
          {needsOnboarding && pathname === "/dashboard" && (
            <div className="px-6 py-3 bg-blue-50 border-t border-blue-200 flex items-center">
              <Alert className="bg-transparent border-0 p-0">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="ml-2 text-sm text-blue-700">
                  Please complete your hospital profile to get started.{" "}
                  <Link
                    href="/dashboard/onboarding"
                    className="font-semibold underline"
                  >
                    Complete Now
                  </Link>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {subscriptionNotice && (
            <div
              className={`px-6 py-3 border-t flex items-center ${
                subscriptionNotice.type === "blocked"
                  ? "bg-red-50 border-red-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <Alert className="bg-transparent border-0 p-0 flex items-center">
                
                <AlertDescription
                  className={`ml-2 text-sm ${
                    subscriptionNotice.type === "blocked"
                      ? "text-red-700"
                      : "text-amber-700"
                  }`}
                >
                  {subscriptionNotice.message}{" "}
                  <Link href="/dashboard/billing" className="font-semibold underline">
                    Manage Billing
                  </Link>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
