"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Mail,
  Star,
  Clock,
  Trash2,
  Reply,
  Wifi,
  WifiOff,
} from "lucide-react";
import { superAdminAPI } from "@/lib/api";
import { io, Socket } from "socket.io-client";

interface WebsiteContactForm {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  hospitalName: string;
  subject: string;
  message: string;
  status: string;
  isStarred: boolean;
  response?: string;
  respondedAt?: string;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3002";

export default function WebsiteMessagesPage() {
  const [messages, setMessages] = useState<WebsiteContactForm[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMessage, setSelectedMessage] = useState<WebsiteContactForm | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
      // Join super admin room
      socketRef.current?.emit("superAdmin:join");
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    // Listen for new website contact form submissions
    socketRef.current.on("websiteContactForm:new", (data: { contactForm: WebsiteContactForm }) => {
      console.log("New contact form received:", data.contactForm);
      setMessages((prev) => [data.contactForm, ...prev]);
      setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [pagination.page, statusFilter]);

  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await superAdminAPI.getWebsiteContactForms({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter === "all" ? "" : statusFilter,
      });

      if (response.data) {
        const data = response.data as any;
        setMessages(data.contactForms || []);
        setPagination(data.pagination || pagination);
      }
    } catch (err: any) {
      console.error("Error fetching messages:", err);
      setError(err.message || "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewMessage = async (message: WebsiteContactForm) => {
    setSelectedMessage(message);
    setIsViewDialogOpen(true);

    // Mark as read if unread
    if (message.status === "unread") {
      try {
        await superAdminAPI.updateWebsiteContactFormStatus(message._id, { status: "read" });
        setMessages((prev) =>
          prev.map((m) => (m._id === message._id ? { ...m, status: "read" } : m))
        );
      } catch (err) {
        console.error("Error marking message as read:", err);
      }
    }
  };

  const handleToggleStar = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const message = messages.find((m) => m._id === id);
    if (!message) return;

    const newStarredStatus = !message.isStarred;
    try {
      await superAdminAPI.updateWebsiteContactFormStatus(id, { isStarred: newStarredStatus });
      setMessages((prev) =>
        prev.map((m) => (m._id === id ? { ...m, isStarred: newStarredStatus } : m))
      );
      if (selectedMessage?._id === id) {
        setSelectedMessage((prev) =>
          prev ? { ...prev, isStarred: newStarredStatus } : null
        );
      }
    } catch (err) {
      console.error("Error toggling star:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    
    try {
      await superAdminAPI.deleteWebsiteContactForm(id);
      setMessages((prev) => prev.filter((m) => m._id !== id));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));
      if (selectedMessage?._id === id) {
        setSelectedMessage(null);
        setIsViewDialogOpen(false);
      }
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const handleReply = (message: WebsiteContactForm) => {
    setSelectedMessage(message);
    setReplyText("");
    setIsReplyDialogOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      await superAdminAPI.updateWebsiteContactFormStatus(selectedMessage._id, {
        response: replyText,
      });

      const updatedMessage = {
        ...selectedMessage,
        status: "responded",
        response: replyText,
        respondedAt: new Date().toISOString(),
      };

      setMessages((prev) =>
        prev.map((m) => (m._id === selectedMessage._id ? updatedMessage : m))
      );
      setSelectedMessage(updatedMessage);
      setIsReplyDialogOpen(false);
      setReplyText("");
    } catch (err) {
      console.error("Error sending reply:", err);
    } finally {
      setIsSendingReply(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      unread: "bg-blue-100 text-blue-800",
      read: "bg-gray-100 text-gray-800",
      starred: "bg-yellow-100 text-yellow-800",
      responded: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Website Messages</h1>
          <p className="text-muted-foreground">
            Contact form submissions from the main website
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={`${isConnected ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'}`}
          >
            {isConnected ? (
              <><Wifi className="h-3 w-3 mr-1" /> Live</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
            )}
          </Badge>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {pagination.total} Messages
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchMessages} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="flex items-center gap-4 pt-6">
            <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">Error</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
            <Button onClick={fetchMessages} variant="outline" size="sm">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Messages Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sender</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <TableRow 
                    key={msg._id} 
                    className={`cursor-pointer hover:bg-muted/50 ${msg.status === 'unread' ? 'bg-blue-50/50' : ''}`}
                    onClick={() => handleViewMessage(msg)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <MessageSquare className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {msg.firstName} {msg.lastName}
                            </p>
                            {msg.isStarred && (
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {msg.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{msg.subject || "General Inquiry"}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
                          {msg.message}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{msg.hospitalName || "N/A"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={getStatusColor(msg.status)}
                      >
                        {msg.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleToggleStar(msg._id, e)}
                        >
                          <Star
                            className={`h-4 w-4 ${msg.isStarred ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReply(msg);
                          }}
                        >
                          <Reply className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(msg._id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No messages found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} messages
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm px-4">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              disabled={pagination.page === pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* View Message Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent 
          title="Message Details"
          className="max-w-2xl"
        >
          <DialogHeader>
            <DialogDescription>
              From {selectedMessage?.firstName} {selectedMessage?.lastName}
            </DialogDescription>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Email</p>
                  <p>{selectedMessage.email}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Hospital</p>
                  <p>{selectedMessage.hospitalName || "N/A"}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Date</p>
                  <p>{new Date(selectedMessage.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(selectedMessage.status)}>
                    {selectedMessage.status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-2">Message</p>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>
              </div>
              {selectedMessage.response && (
                <div>
                  <p className="font-medium text-muted-foreground mb-2">Your Reply</p>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="whitespace-pre-wrap">{selectedMessage.response}</p>
                    {selectedMessage.respondedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Sent on {new Date(selectedMessage.respondedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            {selectedMessage && selectedMessage.status !== "responded" && (
              <Button onClick={() => {
                setIsViewDialogOpen(false);
                handleReply(selectedMessage);
              }}>
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
        <DialogContent title="Reply to Message">
          <DialogHeader>
            <DialogDescription>
              Send a reply to {selectedMessage?.firstName} {selectedMessage?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Original Message:</p>
              <p className="text-muted-foreground line-clamp-3">{selectedMessage?.message}</p>
            </div>
            <Textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendReply} disabled={isSendingReply || !replyText.trim()}>
              {isSendingReply ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Reply className="h-4 w-4 mr-2" />
                  Send Reply
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
