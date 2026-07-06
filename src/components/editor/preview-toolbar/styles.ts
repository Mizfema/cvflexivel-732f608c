export function toolbarButtonClass(active = false) {
  return [
    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
    active ? "bg-[#1D9E75]/10 text-[#1D9E75]" : "text-[#4A4740] hover:bg-black/[0.04]",
  ].join(" ");
}
