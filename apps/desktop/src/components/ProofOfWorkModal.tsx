import { useState } from 'react';

interface ProofOfWorkModalProps {
    isOpen: boolean;
    subTaskTitle: string;
    onSubmit: (proofOfWork: string) => void;
    onClose: () => void;
}

/**
 * Modal shown when a scheduled sub-task auto-stops at its end time.
 * Collects optional proof of work / work summary from the user.
 */
export default function ProofOfWorkModal({ isOpen, subTaskTitle, onSubmit }: ProofOfWorkModalProps) {
    const [proofText, setProofText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        await onSubmit(proofText);
        setProofText('');
        setIsSubmitting(false);
    };

    const handleSkip = () => {
        onSubmit('');
        setProofText('');
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-[#1e293b] rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <span className="text-2xl">⏰</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">সময়সূচী শেষ!</h2>
                        <p className="text-sm text-gray-400">কাজের সারাংশ দিন</p>
                    </div>
                </div>

                {/* Task Info */}
                <div className="bg-[#0f172a] rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-400">সাব-টাস্ক:</p>
                    <p className="text-white font-medium">{subTaskTitle}</p>
                </div>

                {/* Proof of Work Input */}
                <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">
                        আজকে কী কাজ করলেন? (ঐচ্ছিক)
                    </label>
                    <textarea
                        value={proofText}
                        onChange={(e) => setProofText(e.target.value)}
                        placeholder="আজকের কাজের সারাংশ লিখুন..."
                        className="w-full h-24 bg-[#0f172a] border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-yellow-500"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSkip}
                        disabled={isSubmitting}
                        className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-white disabled:opacity-50"
                    >
                        স্কিপ করুন
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 py-3 px-4 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-medium text-black disabled:opacity-50"
                    >
                        {isSubmitting ? 'সাবমিট হচ্ছে...' : 'সাবমিট করুন'}
                    </button>
                </div>
            </div>
        </div>
    );
}
