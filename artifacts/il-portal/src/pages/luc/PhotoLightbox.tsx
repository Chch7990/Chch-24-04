export default function PhotoLightbox({
  photos,
  idx,
  onClose,
  onIdx,
}: {
  photos: string[];
  idx: number;
  onClose: () => void;
  onIdx: (i: number) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/85 grid place-items-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-white text-3xl leading-none"
      >
        ✕
      </button>
      <div className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={photos[idx]}
          alt=""
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
        <div className="mt-3 flex items-center gap-3 text-white text-sm">
          <button
            onClick={() => onIdx((idx - 1 + photos.length) % photos.length)}
            className="px-3 py-1.5 bg-white/15 hover:bg-white/30 rounded font-bold"
            disabled={photos.length < 2}
          >
            ← Prev
          </button>
          <span className="opacity-80">
            {idx + 1} / {photos.length}
          </span>
          <button
            onClick={() => onIdx((idx + 1) % photos.length)}
            className="px-3 py-1.5 bg-white/15 hover:bg-white/30 rounded font-bold"
            disabled={photos.length < 2}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
