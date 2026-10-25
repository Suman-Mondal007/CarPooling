import React, { useState, useEffect } from 'react';
import { Car, Plus, ShieldCheck, Clock, Trash2, Edit2, AlertTriangle, Fuel, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import vehiclesApi from '../../api/vehicles.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Skeleton from '../../components/common/Skeleton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const VEHICLE_TYPES = ['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'OTHER'];
const FUEL_TYPES = ['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID'];

export function VehiclesPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentVehicleId, setCurrentVehicleId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);

  const [formData, setFormData] = useState({
    model: '',
    registrationNumber: '',
    vehicleType: 'SEDAN',
    seatingCapacity: 5,
    color: '',
    fuelType: 'PETROL',
    fuelEfficiencyKmpl: 15
  });

  const [errors, setErrors] = useState({});

  const loadVehicles = async () => {
    setIsLoading(true);
    try {
      const data = await vehiclesApi.getVehicles();
      setVehicles(data.items || []);
    } catch {
      toast.error('Failed to load vehicles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const resetForm = () => {
    setFormData({
      model: '',
      registrationNumber: '',
      vehicleType: 'SEDAN',
      seatingCapacity: 5,
      color: '',
      fuelType: 'PETROL',
      fuelEfficiencyKmpl: 15
    });
    setErrors({});
    setIsEditing(false);
    setCurrentVehicleId(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (vehicle) => {
    setFormData({
      model: vehicle.model,
      registrationNumber: vehicle.registrationNumber,
      vehicleType: vehicle.vehicleType,
      seatingCapacity: vehicle.seatingCapacity,
      color: vehicle.color || '',
      fuelType: vehicle.fuelType,
      fuelEfficiencyKmpl: vehicle.fuelEfficiencyKmpl
    });
    setIsEditing(true);
    setCurrentVehicleId(vehicle._id);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.model.trim()) errs.model = 'Model is required';
    if (!formData.registrationNumber.trim()) {
      errs.registrationNumber = 'Registration number is required';
    } else {
      const normalized = formData.registrationNumber.replace(/[\s-]/g, '').toUpperCase();
      const regRegex = /^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/;
      if (!regRegex.test(normalized)) {
        errs.registrationNumber = 'Invalid Indian format (e.g. KA01AB1234 or 22BH1234AA)';
      }
    }

    if (formData.seatingCapacity < 2 || formData.seatingCapacity > 15) {
      errs.seatingCapacity = 'Seats must be between 2 and 15';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await vehiclesApi.updateVehicle(currentVehicleId, {
          model: formData.model,
          color: formData.color,
          seatingCapacity: Number(formData.seatingCapacity),
          fuelEfficiencyKmpl: Number(formData.fuelEfficiencyKmpl)
        });
        toast.success('Vehicle updated successfully');
      } else {
        const newVehicle = await vehiclesApi.createVehicle({
          ...formData,
          registrationNumber: formData.registrationNumber.replace(/[\s-]/g, '').toUpperCase(),
          seatingCapacity: Number(formData.seatingCapacity),
          fuelEfficiencyKmpl: Number(formData.fuelEfficiencyKmpl)
        });
        if (newVehicle?.verificationStatus === 'PENDING') {
          toast.success('Vehicle registered! Pending admin verification.');
        } else {
          toast.success('Vehicle added successfully!');
        }
      }
      setIsModalOpen(false);
      loadVehicles();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to save vehicle';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this vehicle?')) return;
    setIsDeletingId(id);
    try {
      await vehiclesApi.deleteVehicle(id);
      toast.success('Vehicle removed');
      loadVehicles();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to delete vehicle';
      toast.error(msg);
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Vehicles</h1>
          <p className="text-sm text-slate-500 mt-1">
            Register and manage vehicles used for offering carpool rides to colleagues.
          </p>
        </div>
        <Button onClick={handleOpenAddModal} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Vehicle
        </Button>
      </div>

      {user?.organization?.settings?.requireVehicleVerification && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Company Verification Required</p>
            <p className="mt-0.5 text-amber-700">
              Your company requires admin approval before newly registered vehicles can be used to offer rides. Once approved, the vehicle status will change to Verified.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles registered"
          description="Add your car or two-wheeler to start offering rides and sharing commute costs with coworkers."
          actionText="Add Your First Vehicle"
          onAction={handleOpenAddModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {vehicles.map((v, idx) => (
            <Card
              key={v._id}
              hover
              className={`relative overflow-hidden flex flex-col justify-between animate-slide-up stagger-${Math.min(idx + 1, 5)}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{v.model}</h3>
                    <p className="font-mono text-sm font-semibold tracking-wider text-slate-600 mt-0.5">
                      {v.registrationNumber}
                    </p>
                  </div>
                  {v.verificationStatus === 'VERIFIED' ? (
                    <Badge variant="success" className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </Badge>
                  ) : v.verificationStatus === 'REJECTED' ? (
                    <Badge variant="danger">Rejected</Badge>
                  ) : (
                    <Badge variant="warning" className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-slate-400" />
                    <span>{v.vehicleType}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{v.seatingCapacity} Seats ({v.seatingCapacity - 1} Pass.)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-slate-400" />
                    <span>{v.fuelType}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-700">{v.fuelEfficiencyKmpl} km/l</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditModal(v)}
                  className="flex items-center gap-1 text-xs"
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(v._id)}
                  disabled={isDeletingId === v._id}
                  className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 hover:border-rose-200"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Vehicle Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Vehicle Details' : 'Register New Vehicle'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Vehicle Model"
            placeholder="e.g. Honda City 2022, Tata Nexon EV"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            error={errors.model}
            required
          />

          <Input
            label="Registration Number"
            placeholder="e.g. KA 01 AB 1234 or 22 BH 1234 AA"
            value={formData.registrationNumber}
            onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value.toUpperCase() })}
            error={errors.registrationNumber}
            disabled={isEditing}
            helperText={isEditing ? 'Registration number cannot be modified' : 'Standard Indian state format or Bharat (BH) series'}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Vehicle Type
              </label>
              <select
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={formData.vehicleType}
                onChange={(e) => {
                  const type = e.target.value;
                  const defEfficiency = {
                    HATCHBACK: 18,
                    SEDAN: 15,
                    SUV: 12,
                    MPV: 13,
                    OTHER: 14
                  };
                  setFormData({
                    ...formData,
                    vehicleType: type,
                    fuelEfficiencyKmpl: formData.fuelType === 'ELECTRIC' ? 0 : (defEfficiency[type] || 15)
                  });
                }}
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <Input
              label="Seating Capacity (incl. Driver)"
              type="number"
              min="2"
              max="15"
              value={formData.seatingCapacity}
              onChange={(e) => setFormData({ ...formData, seatingCapacity: e.target.value })}
              error={errors.seatingCapacity}
              helperText={`Offers up to ${Math.max(0, formData.seatingCapacity - 1)} passenger seats`}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fuel Type
              </label>
              <select
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={formData.fuelType}
                onChange={(e) => {
                  const fuel = e.target.value;
                  setFormData({
                    ...formData,
                    fuelType: fuel,
                    fuelEfficiencyKmpl: fuel === 'ELECTRIC' ? 0 : (formData.fuelEfficiencyKmpl || 15)
                  });
                }}
              >
                {FUEL_TYPES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <Input
              label="Fuel Efficiency (km/l)"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={formData.fuelEfficiencyKmpl}
              onChange={(e) => setFormData({ ...formData, fuelEfficiencyKmpl: e.target.value })}
              helperText={formData.fuelType === 'ELECTRIC' ? '0 for Electric Vehicles' : 'Used to estimate commuting travel costs'}
            />
          </div>

          <Input
            label="Vehicle Color (Optional)"
            placeholder="e.g. Pearl White, Silver"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Vehicle' : 'Register Vehicle'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default VehiclesPage;
