import React, { useState, useEffect } from 'react';
import { Bookmark, Plus, Home, Building2, MapPin, Trash2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import placesApi from '../../api/places.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Skeleton from '../../components/common/Skeleton.jsx';
import MapPicker from '../../components/maps/MapPicker.jsx';

const PLACE_TYPES = [
  { value: 'HOME', label: 'Home', icon: Home },
  { value: 'OFFICE', label: 'Office', icon: Building2 },
  { value: 'CUSTOM', label: 'Custom Landmark', icon: MapPin }
];

export function SavedPlacesPage() {
  const [places, setPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPlaceId, setCurrentPlaceId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);

  const [formData, setFormData] = useState({
    label: '',
    placeType: 'HOME',
    address: '',
    lat: null,
    lng: null
  });

  const [errors, setErrors] = useState({});

  const loadPlaces = async () => {
    setIsLoading(true);
    try {
      const data = await placesApi.getSavedPlaces();
      setPlaces(data.items || []);
    } catch {
      toast.error('Failed to load saved places');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlaces();
  }, []);

  const resetForm = () => {
    setFormData({
      label: '',
      placeType: 'HOME',
      address: '',
      lat: null,
      lng: null
    });
    setErrors({});
    setIsEditing(false);
    setCurrentPlaceId(null);
  };

  const handleOpenAddModal = (type = 'CUSTOM') => {
    resetForm();
    setFormData((prev) => ({
      ...prev,
      placeType: type,
      label: type === 'HOME' ? 'Home' : type === 'OFFICE' ? 'Office' : ''
    }));
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (place) => {
    setFormData({
      label: place.label,
      placeType: place.placeType,
      address: place.address,
      lat: place.lat,
      lng: place.lng
    });
    setIsEditing(true);
    setCurrentPlaceId(place._id);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.label.trim()) errs.label = 'Label is required';
    if (!formData.address.trim()) errs.address = 'Location address is required';
    if (!formData.lat || !formData.lng) errs.address = 'Please pick a location on the map';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await placesApi.updateSavedPlace(currentPlaceId, formData);
        toast.success('Place updated successfully');
      } else {
        await placesApi.createSavedPlace(formData);
        toast.success('Place saved successfully');
      }
      setIsModalOpen(false);
      loadPlaces();
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to save place';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this saved place?')) return;
    setIsDeletingId(id);
    try {
      await placesApi.deleteSavedPlace(id);
      toast.success('Place removed');
      loadPlaces();
    } catch {
      toast.error('Failed to delete place');
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Saved Places</h1>
          <p className="text-sm text-slate-500 mt-1">
            Save your home, office, and regular commute stops for 1-click ride offers and searches.
          </p>
        </div>
        <Button onClick={() => handleOpenAddModal('CUSTOM')} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Place
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      ) : places.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved places yet"
          description="Save your primary residence or work branch to quickly autofill addresses when offering or booking rides."
          actionText="Add Home or Office"
          onAction={() => handleOpenAddModal('HOME')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {places.map((place, idx) => {
            const TypeIcon = place.placeType === 'HOME' ? Home : place.placeType === 'OFFICE' ? Building2 : MapPin;
            return (
              <Card
                key={place._id}
                hover
                className={`flex flex-col justify-between animate-slide-up stagger-${Math.min(idx + 1, 5)}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${
                        place.placeType === 'HOME'
                          ? 'bg-blue-50 text-blue-600'
                          : place.placeType === 'OFFICE'
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'bg-teal-50 text-teal-600'
                      }`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{place.label}</h3>
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                          {place.placeType}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 mt-3 line-clamp-2">
                    {place.address}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 font-mono">
                    {place.lat?.toFixed(3)}, {place.lng?.toFixed(3)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(place)}
                      className="p-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(place._id)}
                      disabled={isDeletingId === place._id}
                      className="p-1.5 text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Place Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Saved Place' : 'Add Saved Place'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PLACE_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      placeType: value,
                      label: prev.label ? prev.label : (value === 'HOME' ? 'Home' : value === 'OFFICE' ? 'Office' : '')
                    }));
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition ${
                    formData.placeType === value
                      ? 'border-teal-500 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Label / Name"
            placeholder="e.g. My Flat, Bangalore Main Office"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            error={errors.label}
            required
          />

          <div>
            <MapPicker
              label="Pinpoint Location"
              value={{ address: formData.address, lat: formData.lat, lng: formData.lng }}
              onChange={({ address, lat, lng }) => {
                setFormData((prev) => ({
                  ...prev,
                  address,
                  lat,
                  lng
                }));
              }}
              allowSavedPlaces={false}
              height="240px"
            />
            {errors.address && (
              <p className="text-xs text-rose-600 mt-1">{errors.address}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Place' : 'Save Place'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default SavedPlacesPage;
