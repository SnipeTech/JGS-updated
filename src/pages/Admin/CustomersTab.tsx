import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, UserCircle, PhoneCall, Mail, Trash2, PenLine } from 'lucide-react';
import { Customer } from '@/types';

export const CustomersTab = () => {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useApp();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [show, setShow] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [eAddress, setEAddress] = useState('');
  const [eNotes, setENotes] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name required'); return; }
    addCustomer({ name, phone, email, address, notes, category: 'direct' });
    toast.success('Client added!');
    setName(''); setPhone(''); setEmail(''); setAddress(''); setNotes(''); setShow(false);
  };

  const startEdit = (c: Customer) => {
    setEditId(c.id);
    setEName(c.name);
    setEPhone(c.phone || '');
    setEEmail(c.email || '');
    setEAddress(c.address || '');
    setENotes(c.notes || '');
  };

  const handleSaveEdit = () => {
    if (!editId) return;
    updateCustomer(editId, { name: eName, phone: ePhone, email: eEmail, address: eAddress, notes: eNotes });
    toast.success('Client updated!');
    setEditId(null);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="section-header">Clients Directory</h3>
        <Button
          size="sm"
          onClick={() => setShow(v => !v)}
          className="h-8 rounded-xl gap-1.5 text-xs font-semibold text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Client
        </Button>
      </div>

      {show && (
        <div className="form-card">
          <form onSubmit={handleAdd} className="space-y-3">
            {[
              { l: 'Name', v: name, s: setName, p: 'Client full name' },
              { l: 'Phone', v: phone, s: setPhone, p: '9876543210' },
              { l: 'Email', v: email, s: setEmail, p: 'email@example.com' },
              { l: 'Address', v: address, s: setAddress, p: 'City, State' },
            ].map(({ l, v, s, p }) => (
              <div key={l}>
                <Label className="text-xs font-semibold text-muted-foreground">{l}</Label>
                <Input
                  placeholder={p}
                  value={v}
                  onChange={e => s(e.target.value)}
                  className="mt-1 h-10 rounded-xl text-xs font-semibold"
                />
              </div>
            ))}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Notes</Label>
              <Textarea
                placeholder="Any client notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="mt-1 rounded-xl min-h-[60px] text-xs"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-white font-bold text-xs shadow-sm mt-1"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
            >
              Add Client
            </Button>
          </form>
        </div>
      )}

      {customers.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
          <UserCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No clients recorded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {customers.map(c => (
            <Card key={c.id} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-2.5">
              {editId !== c.id ? (
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                      <UserCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{c.name}</h4>
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                        >
                          <PhoneCall className="w-3 h-3" />
                          {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {c.email}
                        </p>
                      )}
                      {c.address && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{c.address}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <button
                      onClick={() => startEdit(c)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-border/60 hover:bg-muted"
                    >
                      <PenLine className="w-3 h-3 inline mr-1" /> Edit
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        deleteCustomer(c.id);
                        toast.success('Customer deleted');
                      }}
                      className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Edit Client</p>
                  {[
                    { l: 'Name', v: eName, s: setEName },
                    { l: 'Phone', v: ePhone, s: setEPhone },
                    { l: 'Email', v: eEmail, s: setEEmail },
                    { l: 'Address', v: eAddress, s: setEAddress }
                  ].map(({ l, v, s }) => (
                    <div key={l}>
                      <Label className="text-[10px] font-semibold text-muted-foreground">{l}</Label>
                      <Input
                        value={v}
                        onChange={e => s(e.target.value)}
                        className="mt-0.5 h-8 rounded-lg text-xs"
                      />
                    </div>
                  ))}
                  <div>
                    <Label className="text-[10px] font-semibold text-muted-foreground">Notes</Label>
                    <Textarea
                      value={eNotes}
                      onChange={e => setENotes(e.target.value)}
                      className="mt-0.5 rounded-lg min-h-[50px] text-xs"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={handleSaveEdit}
                      className="flex-1 h-8 rounded-lg text-white text-xs font-semibold"
                      style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditId(null)}
                      className="flex-1 h-8 rounded-lg text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {editId !== c.id && c.notes && (
                <p className="text-xs text-muted-foreground italic pt-1.5 border-t border-border/40">"{c.notes}"</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomersTab;
