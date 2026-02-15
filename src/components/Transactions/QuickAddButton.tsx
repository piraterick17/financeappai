import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { AddMovementModal } from './AddMovementModal';

export function QuickAddButton() {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-fg rounded-xl font-bold hover:bg-opacity-90 transition shadow-lg shadow-primary/20 animate-in fade-in slide-in-from-right-4"
            >
                <PlusCircle className="w-5 h-5" />
                <span className="hidden sm:inline">Nuevo Movimiento</span>
                <span className="sm:hidden">Nuevo</span>
            </button>

            {showModal && (
                <AddMovementModal
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
}
