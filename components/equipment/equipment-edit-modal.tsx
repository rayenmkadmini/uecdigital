"use client";

import React, { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Check, AlertCircle, Loader2, Edit2 } from "lucide-react";
import { updateEquipmentAction } from "@/app/actions/equipment";
import type {
  EquipmentListItem,
  EquipmentCategory,
  EquipmentCondition,
  EquipmentStatus,
} from "@/lib/data/equipment";

interface EquipmentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: EquipmentListItem | null;
  onSuccess: (updated: EquipmentListItem) => void;
}

const CATEGORY_OPTIONS: Array<{ value: EquipmentCategory; label: string }> = [
  { value: "PHOTO_VIDEO", label: "Photo & Vidéo" },
  { value: "AUDIO", label: "Prise de Son & Micros" },
  { value: "INFORMATIQUE", label: "Informatique & Régie" },
  { value: "ACCESSOIRES", label: "Accessoires & Trépieds" },
  { value: "SONO", label: "Sonorisation" },
  { value: "LOGISTIQUE", label: "Logistique Événementielle" },
  { value: "AUTRE", label: "Autre Matériel" },
];

const CONDITION_OPTIONS: Array<{ value: EquipmentCondition; label: string }> = [
  { value: "EXCELLENT", label: "Neuf / Excellent État" },
  { value: "GOOD", label: "Bon État de Fonctionnement" },
  { value: "FAIR", label: "État Moyen (Traces d'usure)" },
  { value: "DAMAGED", label: "Endommagé / Nécessite Réparation" },
  { value: "MAINTENANCE", label: "En Maintenance / SAV" },
];

export function EquipmentEditModal({
  isOpen,
  onClose,
  equipment,
  onSuccess,
}: EquipmentEditModalProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState(equipment?.name || "");
  const [category, setCategory] = useState<EquipmentCategory>(equipment?.category || "PHOTO_VIDEO");
  const [condition, setCondition] = useState<EquipmentCondition>(equipment?.condition || "GOOD");
  const [serialNumber, setSerialNumber] = useState(equipment?.serial_number || "");
  const [storageLocation, setStorageLocation] = useState(equipment?.storage_location || "");
  const [description, setDescription] = useState(equipment?.description || "");

  React.useEffect(() => {
    if (equipment) {
      setName(equipment.name);
      setCategory(equipment.category);
      setCondition(equipment.condition);
      setSerialNumber(equipment.serial_number || "");
      setStorageLocation(equipment.storage_location || "");
      setDescription(equipment.description || "");
    }
    setErrorMsg(null);
  }, [equipment, isOpen]);

  if (!equipment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await updateEquipmentAction(equipment.id, {
          name: name.trim(),
          category,
          condition,
          serial_number: serialNumber.trim() || undefined,
          storage_location: storageLocation.trim() || undefined,
          description: description.trim() || undefined,
        });

        if (!res.success) {
          setErrorMsg(res.message);
          return;
        }

        const updated: EquipmentListItem = {
          ...equipment,
          name: name.trim(),
          category,
          condition,
          serial_number: serialNumber.trim() || null,
          storage_location: storageLocation.trim() || null,
          description: description.trim() || null,
          updated_at: new Date().toISOString(),
        };

        onSuccess(updated);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || "Erreur lors de la modification du matériel.");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Edit2 size={18} className="text-uec-red" />
          <span>Modifier l'Équipement {equipment.code}</span>
        </div>
      }
      description={`Mise à jour de la fiche technique et de l'état pour "${equipment.name}".`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Désignation du matériel *
          </label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Boîtier Sony FX3 + Cage SmallRig"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Catégorie *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
              className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              État physique *
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as EquipmentCondition)}
              className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none"
            >
              {CONDITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Numéro de Série
            </label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Ex: SN-889342-UEC"
              className="font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Emplacement de stockage
            </label>
            <Input
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="Ex: Armoire A / Régie Vidéo"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">
            Description / Accessoires inclus
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Inclus 2 batteries NP-FZ100, chargeur double et carte SD 128 Go..."
            className="w-full bg-[#111827] border border-[#27354F] text-white text-xs rounded-lg p-2.5 focus:border-uec-red focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1F2937]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isPending}
            className="flex items-center gap-1.5 bg-uec-red hover:bg-uec-red/90 text-white"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Enregistrer</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
