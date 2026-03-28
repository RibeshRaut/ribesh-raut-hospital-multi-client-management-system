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
  Building2,
  Calendar,
  Stethoscope,
  MessageSquare,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  Users,
  Activity,
  Shield,
  Loader2,
  Check,
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
import { Badge } from "@/components/ui/badge";
import { superAdminAPI, tokenManager } from "@/lib/api";

const sidebarLinks = [
  {
    href: "/super-admin",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/super-admin/hospitals",
    label: "Hospitals",
    icon: Building2,
  },
  {
    href: "/super-admin/doctors",
    label: "All Doctors",
    icon: Stethoscope,
  },
  {
    href: "/super-admin/appointments",
    label: "All Appointments",
    icon: Calendar,
  },
  {
    href: "/super-admin/patients",
    label: "All Patients",
    icon: Users,
  },
  {
    href: "/super-admin/messages",
    label: "All Messages",
    icon: MessageSquare,
  },
];

const bottomLinks = [
  {
    href: "/super-admin/settings",
    label: "Settings",
    icon: Settings,
  },
];

interface UserInfo {
  id: string;
  userType: string;
  username?: string;
}

interface SuperAdminNotification {
  _id: string;
  firstName?: string;
  lastName?: string;
  subject?: string;
  message?: string;
  status?: string;
  createdAt?: string;
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<SuperAdminNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotificationData = async () => {
    try {
      setIsNotificationsLoading(true);

      const notificationsResponse = await superAdminAPI.getWebsiteContactForms({
        page: 1,
        limit: 10,
        status: "unread",
      });

      const typedNotifications = (notificationsResponse?.data || {}) as {
        contactForms?: SuperAdminNotification[];
        pagination?: {
          total?: number;
        };
      };
      setRecentNotifications(typedNotifications.contactForms || []);
      setUnreadNotifications(typedNotifications.pagination?.total || 0);
    } catch (error) {
      console.error("Error fetching super admin notifications:", error);
    } finally {
      setIsNotificationsLoading(false);
    }
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Check authentication and user info
    const checkAuth = async () => {
      const token = tokenManager.getToken();
      const user = localStorage.getItem("userInfo");

      if (!token || !user) {
        router.push("/login");
        return;
      }

      try {
        const userData: UserInfo = JSON.parse(user);
        
        // Check if user is a super admin (website_admin)
        if (userData.userType !== "website_admin") {
          // Redirect hospital admins to their dashboard
          router.push("/dashboard");
          return;
        }

        setUserInfo(userData);
        await fetchNotificationData();
        intervalId = setInterval(fetchNotificationData, 30000);
      } catch (error) {
        console.error("Error parsing user info:", error);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [router, pathname]);

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const handleNotificationClick = async (notification: SuperAdminNotification) => {
    try {
      if (notification.status === "unread") {
        await superAdminAPI.updateWebsiteContactFormStatus(notification._id, {
          status: "read",
        });

        setRecentNotifications((prev) =>
          prev.filter((item) => item._id !== notification._id)
        );
        setUnreadNotifications((prev) => Math.max(prev - 1, 0));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    } finally {
      setIsNotificationOpen(false);
      router.push("/super-admin/messages");
    }
  };

  const handleLogout = () => {
    tokenManager.removeToken();
    localStorage.removeItem("userInfo");
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

  const displayName = userInfo?.username || "Super Admin";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen flex bg-secondary">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full">
        <div className="p-4 border-b border-slate-700">
          <Link href="/super-admin" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-amber-500" />
            <div>
              <span className="font-bold text-lg">HMT</span>
              <span className="text-xs block text-amber-500">Super Admin</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Main Menu
          </p>
          <ul className="space-y-1">
            {sidebarLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/super-admin" && pathname.startsWith(link.href));
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-amber-500 text-slate-900"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <link.icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <Separator className="my-4 bg-slate-700" />

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
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
                        ? "bg-amber-500 text-slate-900"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
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

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10 bg-amber-500 text-slate-900">
              <AvatarImage src="" />
              <AvatarFallback className="bg-amber-500 text-slate-900 font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-slate-400 truncate">Super Admin</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full gap-2 border-slate-600 text-slate-300 bg-slate-800 hover:text-white hover:bg-slate-700"
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
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Activity className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">
                  {sidebarLinks.find(
                    (l) =>
                      l.href === pathname ||
                      (l.href !== "/super-admin" && pathname.startsWith(l.href))
                  )?.label ||
                    bottomLinks.find((l) => l.href === pathname)?.label ||
                    "Super Admin Dashboard"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Platform Administration
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Popover
                open={isNotificationOpen}
                onOpenChange={(open) => {
                  setIsNotificationOpen(open);
                  if (open) {
                    fetchNotificationData();
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                        {unreadNotifications > 9 ? "9+" : unreadNotifications}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {unreadNotifications > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {unreadNotifications} unread
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setIsNotificationOpen(false);
                          router.push("/super-admin/messages");
                        }}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        View all
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[320px]">
                    {isNotificationsLoading && recentNotifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-amber-500 mb-2" />
                        <p className="text-sm text-muted-foreground">Loading notifications...</p>
                      </div>
                    ) : recentNotifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                        <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No unread notifications</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {recentNotifications.map((notification) => {
                          const fullName = `${notification.firstName || ""} ${notification.lastName || ""}`.trim() || "Unknown sender";
                          return (
                            <button
                              key={notification._id}
                              type="button"
                              onClick={() => handleNotificationClick(notification)}
                              className="w-full text-left p-4 hover:bg-secondary/50 transition-colors bg-blue-50/50"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold line-clamp-1">
                                  {notification.subject || "New Message"}
                                </p>
                                <Badge variant="default" className="bg-blue-500 text-[10px] px-1 py-0 h-4">
                                  NEW
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {fullName}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {notification.message || "You have a new contact form message."}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {formatTime(notification.createdAt)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <Avatar className="h-8 w-8 bg-amber-500 text-slate-900">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-amber-500 text-slate-900 font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline">{displayName}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>
                    <Link href="/super-admin/settings" className="flex w-full">
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
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
