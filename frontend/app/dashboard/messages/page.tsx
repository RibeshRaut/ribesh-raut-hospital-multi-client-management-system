"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Mail,
  MailOpen,
  Clock,
  Phone,
  Search,
  Trash2,
  CheckCheck,
  ArrowLeft,
  Reply,
  MoreVertical,
  Inbox,
  Star,
  StarOff,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { contactFormAPI, APIError } from "@/lib/api";
import { useSocket } from "@/lib/useSocket";

type Message = {
  id: string;
  _id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
  status: string;
  isStarred: boolean;
  image?: string;
};

type FilterType = "all" | "unread" | "starred";

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState<string>("");
  const { socket, on } = useSocket({ autoConnect: true });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("userInfo") || "{}");
    const hId = user?.hospitalId || user?._id || user?.id;
    if (hId) {
      setHospitalId(hId);
      fetchMessages(hId);
    } else {
      setError("Hospital ID not found. Please log in again.");
      setIsLoading(false);
    }
  }, []);

  // Setup real-time listeners for contact form updates
  useEffect(() => {
    if (!socket || !hospitalId) return;

    // Join hospital room for contact form updates
    socket.emit('contactForm:join', { hospitalId });

    // Listen for new contact form submissions
    const unsubscribeSubmitted = on('contactForm:submitted', (data) => {
      console.log('🔔 New contact form received:', data);
      if (data.hospitalId === hospitalId) {
        // Add the new message to the list
        setMessages((prev) => [
          {
            ...data,
            id: data._id,
            isStarred: data.isStarred || false,
            subject: data.subject || 'General Inquiry',
          },
          ...prev,
        ]);
      }
    });

    // Listen for contact form status updates
    const unsubscribeStatusUpdated = on('contactForm:statusUpdated', (data) => {
      console.log('🔔 Contact form status updated:', data);
      if (data.hospitalId === hospitalId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data._id
              ? {
                  ...msg,
                  status: data.status,
                  isStarred: data.isStarred ?? msg.isStarred,
                }
              : msg
          )
        );
      }
    });

    return () => {
      unsubscribeSubmitted();
      unsubscribeStatusUpdated();
    };
  }, [socket, hospitalId, on]);

  const fetchMessages = async (hId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await contactFormAPI.getByHospital(hId);
      const fetchedMessages = ((response.data as any[]) || []).map((msg: any) => ({
        ...msg,
        id: msg._id,
        isStarred: msg.isStarred || false,
        subject: msg.subject || "General Inquiry",
      }));
      setMessages(fetchedMessages);
    } catch (err: any) {
      console.error("Error fetching messages:", err);
      setError(err.message || "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  };

  const unreadCount = messages.filter((m) => m.status === "unread").length;

  const filteredMessages = messages.filter((message) => {
    const matchesSearch =
      message.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (filter === "unread") return matchesSearch && message.status === "unread";
    if (filter === "starred") return matchesSearch && message.isStarred;
    return matchesSearch;
  });

  const handleSelectMessage = async (message: Message) => {
    // Mark as read on the server when selecting
    if (message.status === "unread") {
      try {
        await contactFormAPI.updateStatus(message._id, { status: "read" });
        setMessages((prev) =>
          prev.map((m) => (m._id === message._id ? { ...m, status: "read" } : m)),
        );
      } catch (err) {
        console.error("Error marking message as read:", err);
      }
    }
    setSelectedMessage({ ...message, status: "read" });
  };

  const handleMarkAsUnread = async (id: string) => {
    try {
      await contactFormAPI.updateStatus(id, { status: "unread" });
      setMessages((prev) =>
        prev.map((m) => (m._id === id ? { ...m, status: "unread" } : m)),
      );
      setSelectedMessage(null);
    } catch (err) {
      console.error("Error marking message as unread:", err);
    }
  };

  const handleToggleStar = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const message = messages.find((m) => m._id === id);
    if (!message) return;

    const newStarredStatus = !message.isStarred;
    
    try {
      await contactFormAPI.updateStatus(id, { isStarred: newStarredStatus });
      setMessages((prev) =>
        prev.map((m) => (m._id === id ? { ...m, isStarred: newStarredStatus } : m)),
      );
      if (selectedMessage?._id === id) {
        setSelectedMessage((prev) =>
          prev ? { ...prev, isStarred: newStarredStatus } : null,
        );
      }
    } catch (err) {
      console.error("Error toggling star:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await contactFormAPI.delete(id);
      setMessages((prev) => prev.filter((m) => m._id !== id));
      if (selectedMessage?._id === id) {
        setSelectedMessage(null);
      }
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadMessages = messages.filter((m) => m.status === "unread");
    try {
      await Promise.all(
        unreadMessages.map((m) => contactFormAPI.updateStatus(m._id, { status: "read" }))
      );
      setMessages((prev) => prev.map((m) => ({ ...m, status: "read" })));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)]">
        <Card className="bg-destructive/10 border-destructive">
          <div className="flex items-center gap-4 p-6">
            <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">Error Loading Messages</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
            <Button onClick={() => fetchMessages(hospitalId)} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <Card className="h-full overflow-hidden">
        <div className="flex h-full">
          {/* Sidebar - Message List */}
          <div
            className={`w-full md:w-96 border-r border-border flex flex-col shrink-0 ${
              selectedMessage ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Search & Filter Header */}
            <div className="p-4 border-b border-border space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={filter === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("all")}
                  className="gap-1.5"
                >
                  <Inbox className="h-4 w-4" />
                  All
                  <Badge variant="secondary" className="ml-1">
                    {messages.length}
                  </Badge>
                </Button>
                <Button
                  variant={filter === "unread" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("unread")}
                  className="gap-1.5"
                >
                  <Mail className="h-4 w-4" />
                  Unread
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
                <Button
                  variant={filter === "starred" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("starred")}
                  className="gap-1.5"
                >
                  <Star className="h-4 w-4" />
                  Starred
                </Button>
              </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto">
              {filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                  <Inbox className="h-12 w-12 mb-3 opacity-50" />
                  <p className="font-medium">No messages found</p>
                  <p className="text-sm">Try adjusting your search or filter</p>
                </div>
              ) : (
                filteredMessages.map((message) => (
                  <div
                    key={message._id}
                    onClick={() => handleSelectMessage(message)}
                    className={`p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${
                      message.status === "unread" ? "bg-primary/5" : ""
                    } ${selectedMessage?._id === message._id ? "bg-muted" : ""}`}
                  >
                    <div className="flex gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={message.image} />
                        <AvatarFallback>
                          {message.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span
                            className={`truncate ${
                              message.status === "unread"
                                ? "font-semibold text-foreground"
                                : "font-medium text-muted-foreground"
                            }`}
                          >
                            {message.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => handleToggleStar(message._id, e)}
                              className="p-1 hover:bg-muted rounded"
                            >
                              {message.isStarred ? (
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ) : (
                                <StarOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(message.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p
                          className={`text-sm truncate mb-1 ${
                            message.status === "unread"
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {message.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {message.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with Mark All Read */}
            {unreadCount > 0 && (
              <div className="p-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleMarkAllAsRead}
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark all as read
                </Button>
              </div>
            )}
          </div>

          {/* Message Detail View */}
          <div
            className={`flex-1 flex flex-col min-w-0 ${
              selectedMessage ? "flex" : "hidden md:flex"
            }`}
          >
            {selectedMessage ? (
              <>
                {/* Message Header */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="md:hidden gap-2"
                      onClick={() => setSelectedMessage(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStar(selectedMessage._id)}
                      >
                        {selectedMessage.isStarred ? (
                          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        ) : (
                          <StarOff className="h-5 w-5" />
                        )}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              handleMarkAsUnread(selectedMessage._id)
                            }
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Mark as unread
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(selectedMessage._id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <h2 className="text-xl font-semibold mb-4">
                    {selectedMessage.subject}
                  </h2>

                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={selectedMessage.image} />
                      <AvatarFallback>
                        {selectedMessage.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          {selectedMessage.name}
                        </span>
                        <span className="text-sm text-muted-foreground truncate">
                          &lt;{selectedMessage.email}&gt;
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {formatFullDate(selectedMessage.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {selectedMessage.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Message Body */}
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="max-w-2xl">
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {selectedMessage.message}
                    </p>
                  </div>
                </div>

                {/* Message Actions */}
                <div className="p-4 border-t border-border">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button asChild className="gap-2">
                      <a href={`mailto:${selectedMessage.email}`}>
                        <Reply className="h-4 w-4" />
                        Reply
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleMarkAsUnread(selectedMessage._id)}
                    >
                      <MailOpen className="h-4 w-4" />
                      Mark as Unread
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(selectedMessage._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Mail className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-1">
                  Select a message
                </h3>
                <p className="text-sm">
                  Choose a message from the list to view its contents
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
