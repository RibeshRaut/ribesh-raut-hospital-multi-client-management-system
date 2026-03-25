"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, MoreHorizontal, Pencil, Trash2, Clock, Loader2 } from "lucide-react";
import { scheduleAPI, doctorAPI } from "@/lib/api";

type Doctor = {
  _id: string;
  name: string;
  specialty: string;
  photo?: string;
};

type Schedule = {
  _id: string;
  doctorId: Doctor | string;
  hospitalId: string;
  days: string[];
  startTime: string;
  endTime: string;
  maxPatients: number;
  slotDuration: number;
  status: "Active" | "Inactive";
};

const weekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(
    null,
  );

  const [formData, setFormData] = useState({
    doctorId: "",
    days: [] as string[],
    startTime: "",
    endTime: "",
    maxPatients: "",
    slotDuration: "30",
    status: "Active" as Schedule["status"],
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

  // Fetch schedules and doctors on mount
  useEffect(() => {
    const fetchData = async () => {
      const hospitalId = getHospitalId();
      if (!hospitalId) {
        setIsLoading(false);
        return;
      }

      try {
        const [schedulesResponse, doctorsResponse] = await Promise.all([
          scheduleAPI.getByHospital(hospitalId),
          doctorAPI.getByHospital(hospitalId),
        ]);
        setSchedules(schedulesResponse.data as Schedule[]);
        setDoctors(doctorsResponse.data as Doctor[]);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper to get doctor info from schedule
  const getDoctorFromSchedule = (schedule: Schedule): Doctor | undefined => {
    if (typeof schedule.doctorId === 'object' && schedule.doctorId !== null) {
      return schedule.doctorId as Doctor;
    }
    return doctors.find(d => d._id === schedule.doctorId);
  };

  const handleOpenDialog = (schedule?: Schedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      const doctor = getDoctorFromSchedule(schedule);
      setFormData({
        doctorId: doctor?._id || (typeof schedule.doctorId === 'string' ? schedule.doctorId : ''),
        days: schedule.days,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        maxPatients: schedule.maxPatients.toString(),
        slotDuration: schedule.slotDuration?.toString() || "30",
        status: schedule.status,
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        doctorId: "",
        days: [],
        startTime: "",
        endTime: "",
        maxPatients: "",
        slotDuration: "30",
        status: "Active",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const hospitalId = getHospitalId();
    if (!hospitalId || !formData.doctorId) return;

    setIsSaving(true);
    try {
      const scheduleData = {
        doctorId: formData.doctorId,
        hospitalId,
        days: formData.days,
        startTime: formData.startTime,
        endTime: formData.endTime,
        maxPatients: parseInt(formData.maxPatients) || 20,
        slotDuration: parseInt(formData.slotDuration) || 30,
        status: formData.status,
      };

      if (editingSchedule) {
        const response = await scheduleAPI.update(editingSchedule._id, scheduleData);
        setSchedules(
          schedules.map((s) =>
            s._id === editingSchedule._id ? (response.data as Schedule) : s
          )
        );
      } else {
        const response = await scheduleAPI.create(scheduleData);
        setSchedules([...schedules, response.data as Schedule]);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSchedule) return;

    setIsSaving(true);
    try {
      await scheduleAPI.delete(deletingSchedule._id);
      setSchedules(schedules.filter((s) => s._id !== deletingSchedule._id));
      setIsDeleteDialogOpen(false);
      setDeletingSchedule(null);
    } catch (error) {
      console.error('Error deleting schedule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));
  };

  const getStatusBadge = (status: Schedule["status"]) => {
    return (
      <Badge variant={status === "Active" ? "default" : "secondary"}>
        {status}
      </Badge>
    );
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  const columns: ColumnDef<Schedule>[] = [
    {
      accessorKey: "doctorName",
      header: "Doctor",
      cell: ({ row }) => {
        const schedule = row.original;
        const doctor = getDoctorFromSchedule(schedule);
        const doctorName = doctor?.name || 'Unknown Doctor';
        const doctorSpecialty = doctor?.specialty || '';
        const doctorPhoto = doctor?.photo || '';
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={doctorPhoto ? `http://localhost:3002${doctorPhoto}` : ''} />
              <AvatarFallback>
                {doctorName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{doctorName}</p>
              <p className="text-sm text-muted-foreground">
                {doctorSpecialty}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "days",
      header: "Working Days",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.days.map((day) => (
            <Badge key={day} variant="outline" className="text-xs">
              {day.slice(0, 3)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "startTime",
      header: "Hours",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          {formatTime(row.original.startTime)} -{" "}
          {formatTime(row.original.endTime)}
        </div>
      ),
    },
    {
      accessorKey: "maxPatients",
      header: "Max Patients",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.maxPatients} per day
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
        const schedule = row.original;
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
              <DropdownMenuItem onClick={() => handleOpenDialog(schedule)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setDeletingSchedule(schedule);
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
            Manage doctor schedules and availability
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={doctors.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={schedules}
          searchKey="doctorName"
          searchPlaceholder="Search by doctor name..."
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          title={editingSchedule ? "Edit Schedule" : "Add New Schedule"}
          className="sm:max-w-[500px]"
        >
          <DialogHeader>
            <DialogDescription>
              {editingSchedule
                ? "Update the schedule details below."
                : "Set up a new schedule for a doctor."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="doctor">Doctor</Label>
              <Select
                value={formData.doctorId}
                onValueChange={(value) =>
                  setFormData({ ...formData, doctorId: value })
                }
                disabled={!!editingSchedule}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor._id} value={doctor._id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={doctor.photo ? `http://localhost:3002${doctor.photo}` : ''} />
                          <AvatarFallback>
                            {doctor.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          {doctor.name} - {doctor.specialty}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Working Days</Label>
              <div className="grid grid-cols-4 gap-2">
                {weekDays.map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={day}
                      checked={formData.days.includes(day)}
                      onCheckedChange={() => toggleDay(day)}
                    />
                    <Label htmlFor={day} className="text-sm font-normal">
                      {day.slice(0, 3)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="maxPatients">Max Patients per Day</Label>
                <Input
                  id="maxPatients"
                  type="number"
                  placeholder="20"
                  value={formData.maxPatients}
                  onChange={(e) =>
                    setFormData({ ...formData, maxPatients: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Schedule["status"]) =>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchedule ? "Save Changes" : "Add Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent 
          title="Delete Schedule"
          className="sm:max-w-[400px]"
        >
          <DialogHeader>
            <DialogDescription>
              Are you sure you want to delete this schedule? This action cannot be undone.
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
