import { useState } from "react";
import { useListServices, useCreateService, useUpdateService, useDeleteService } from "@workspace/api-client-react";
import { getListServicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface ServiceForm { name: string; description: string; durationMinutes: string; price: string; isActive: boolean; }
const defaultForm: ServiceForm = { name: "", description: "", durationMinutes: "30", price: "25", isActive: true };

export default function AdminServices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceForm>(defaultForm);

  const { data: services, isLoading } = useListServices();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });

  const createService = useCreateService({ mutation: { onSuccess: () => { invalidate(); setShowForm(false); setForm(defaultForm); toast({ title: "Service created" }); } } });
  const updateService = useUpdateService({ mutation: { onSuccess: () => { invalidate(); setShowForm(false); setEditId(null); setForm(defaultForm); toast({ title: "Service updated" }); } } });
  const deleteService = useDeleteService({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Service deleted" }); } } });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name, description: form.description, durationMinutes: parseInt(form.durationMinutes), price: parseFloat(form.price), isActive: form.isActive };
    if (editId) { updateService.mutate({ serviceId: editId, data }); }
    else { createService.mutate({ data }); }
  };

  const handleEdit = (s: any) => {
    setForm({ name: s.name, description: s.description ?? "", durationMinutes: String(s.durationMinutes), price: String(s.price), isActive: s.isActive });
    setEditId(s.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Services</h1>
        <Button size="sm" className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => { setShowForm(true); setEditId(null); setForm(defaultForm); }}>
          Add Service
        </Button>
      </div>

      {showForm && (
        <Card className="border-amber-200">
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Name</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Classic Haircut" required />
                </div>
                <div>
                  <Label className="mb-1 block">Price (₹)</Label>
                  <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} min="0" step="0.01" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Duration (min)</Label>
                  <Input type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} min="5" required />
                </div>
                <div>
                  <Label className="mb-1 block">Description</Label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" size="sm" className="bg-gray-900 text-white hover:bg-gray-800" disabled={createService.isPending || updateService.isPending}>
                  {editId ? "Update" : "Create"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Service</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(services ?? []).map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{s.name}</div>
                    {s.description && <div className="text-xs text-gray-400">{s.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.durationMinutes}m</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">₹{s.price}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(s)}>Edit</Button>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => deleteService.mutate({ serviceId: s.id })} disabled={deleteService.isPending}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
