import { useState } from "react";
import { useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  barber: "bg-amber-100 text-amber-700",
  customer: "bg-blue-100 text-blue-700",
};

export default function AdminUsers() {
  const { data: users, isLoading, refetch } = useListUsers();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    specialties: "",
    maxQueueSize: "10",
    avgServiceTime: "20",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast({ title: "Missing fields", description: "Name, email and password are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("salon_token");
      const res = await fetch("/api/admin/barbers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          specialties: form.specialties || undefined,
          maxQueueSize: parseInt(form.maxQueueSize, 10) || 10,
          avgServiceTime: parseInt(form.avgServiceTime, 10) || 20,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message ?? data.error ?? "Failed to create barber.", variant: "destructive" });
        return;
      }
      toast({ title: "Barber created", description: `${data.user.name} can now sign in as a barber.` });
      setModalOpen(false);
      setForm({ name: "", email: "", password: "", phone: "", specialties: "", maxQueueSize: "10", avgServiceTime: "20" });
      refetch();
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">{(users ?? []).length} total users</p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-gray-900 text-white hover:bg-gray-800 gap-1.5"
          size="sm"
        >
          <Plus className="w-4 h-4" /> Add Barber
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Penalty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(users ?? []).map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.penaltyPoints > 0 ? (
                      <span className="text-red-600 font-semibold">{user.penaltyPoints}</span>
                    ) : (
                      <span className="text-gray-300">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Barber</DialogTitle>
            <DialogDescription>
              Create a barber account. They will sign in using these credentials.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Full Name *</Label>
                <Input name="name" value={form.name} onChange={handleChange} placeholder="Jane Smith" />
              </div>
              <div>
                <Label className="mb-1 block">Phone</Label>
                <Input name="phone" value={form.phone} onChange={handleChange} placeholder="555-0123" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Email *</Label>
              <Input name="email" type="email" value={form.email} onChange={handleChange} placeholder="jane@salon.com" />
            </div>
            <div>
              <Label className="mb-1 block">Password *</Label>
              <Input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Minimum 6 characters" />
            </div>
            <div>
              <Label className="mb-1 block">Specialties</Label>
              <Input name="specialties" value={form.specialties} onChange={handleChange} placeholder="Fades, Beard trims..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Max Queue Size</Label>
                <Input name="maxQueueSize" type="number" value={form.maxQueueSize} onChange={handleChange} min="1" max="50" />
              </div>
              <div>
                <Label className="mb-1 block">Avg Service Time (min)</Label>
                <Input name="avgServiceTime" type="number" value={form.avgServiceTime} onChange={handleChange} min="5" max="120" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1 bg-gray-900 text-white hover:bg-gray-800">
                {submitting ? "Creating..." : "Create Barber"}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
