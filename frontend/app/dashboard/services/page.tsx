"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Heart,
  Brain,
  Bone,
  Baby,
  Stethoscope,
  Activity,
  Eye,
  Ear,
  Loader2,
} from "lucide-react";
import { serviceAPI } from "@/lib/api";

type Service = {
  _id: string;
  name: string;
  category: string;
  description: string;
  duration: number;
  price: number;
  status: "Active" | "Inactive";
  icon: string;
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Heart,
  Brain,
  Bone,
  Baby,
  Stethoscope,
  Activity,
  Eye,
  Ear,
};

const categories = [
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "General Medicine",
  "Rehabilitation",
  "Ophthalmology",
  "ENT",
  "Dermatology",
  "Psychiatry",
];

const iconOptions = [
  "Heart",
  "Brain",
  "Bone",
  "Baby",
  "Stethoscope",
  "Activity",
  "Eye",
  "Ear",
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    duration: "",
    price: "",
    status: "Active" as Service["status"],
    icon: "Stethoscope",
  });

  // Get hospitalId from localStorage
  const getHospitalId = () => {
    if (typeof window !== 'undefined') {
      const userInfo = localStorage.getItem('userInfo');
      if (userInfo) {
        const parsed = JSON.parse(userInfo);
        return parsed.hospitalId;
      }
    }
    return null;
  };

  // Fetch services on mount
  useEffect(() => {
    const fetchServices = async () => {
      const hospitalId = getHospitalId();
      if (!hospitalId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await serviceAPI.getByHospital(hospitalId);
        setServices(response.data as Service[]);
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchServices();
  }, []);

  const handleOpenDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        category: service.category,
        description: service.description,
        duration: service.duration.toString(),
        price: service.price?.toString() || "0",
        status: service.status,
        icon: service.icon,
      });
    } else {
      setEditingService(null);
      setFormData({
        name: "",
        category: "",
        description: "",
        duration: "",
        price: "",
        status: "Active",
        icon: "Stethoscope",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const hospitalId = getHospitalId();
    if (!hospitalId) return;

    setIsSaving(true);
    try {
      const serviceData = {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        duration: parseInt(formData.duration) || 30,
        price: parseFloat(formData.price) || 0,
        status: formData.status,
        icon: formData.icon,
        hospitalId,
      };

      if (editingService) {
        const response = await serviceAPI.update(editingService._id, serviceData);
        setServices(
          services.map((s) =>
            s._id === editingService._id ? (response.data as Service) : s
          )
        );
      } else {
        const response = await serviceAPI.create(serviceData);
        setServices([...services, response.data as Service]);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving service:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingService) return;

    setIsSaving(true);
    try {
      await serviceAPI.delete(deletingService._id);
      setServices(services.filter((s) => s._id !== deletingService._id));
      setIsDeleteDialogOpen(false);
      setDeletingService(null);
    } catch (error) {
      console.error('Error deleting service:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: Service["status"]) => {
    return (
      <Badge variant={status === "Active" ? "default" : "secondary"}>
        {status}
      </Badge>
    );
  };

  const columns: ColumnDef<Service>[] = [
    {
      accessorKey: "name",
      header: "Service",
      cell: ({ row }) => {
        const service = row.original;
        const IconComponent = iconMap[service.icon] || Stethoscope;
        return (
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{service.name}</p>
              <p className="text-sm text-muted-foreground">
                {service.category}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <p className="text-sm text-muted-foreground max-w-xs truncate">
          {row.original.description}
        </p>
      ),
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.duration} mins
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const service = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleOpenDialog(service)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setDeletingService(service);
                  setIsDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Manage hospital services and treatments
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={services}
          searchKey="name"
          searchPlaceholder="Search services..."
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          title={editingService ? "Edit Service" : "Add New Service"}
          className="sm:max-w-[500px]"
        >
          <DialogHeader>
            <DialogDescription>
              {editingService
                ? "Update the service details below."
                : "Fill in the details to add a new service."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Service Name</Label>
              <Input
                id="name"
                placeholder="e.g., Cardiac Consultation"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="icon">Icon</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) =>
                    setFormData({ ...formData, icon: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((icon) => {
                      const IconComp = iconMap[icon];
                      return (
                        <SelectItem key={icon} value={icon}>
                          <div className="flex items-center gap-2">
                            {IconComp && <IconComp className="h-4 w-4" />}
                            {icon}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the service..."
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="30"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: Service["status"]) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingService ? "Save Changes" : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent 
          title="Delete Service"
          className="sm:max-w-[400px]"
        >
          <DialogHeader>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingService?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
