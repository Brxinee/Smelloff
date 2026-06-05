import { nav } from "@/lib/content";

/** Genuine announcement only — real free-ship threshold + COD availability. */
export function AnnouncementBar() {
  return (
    <div className="bg-brand text-on-brand">
      <p className="container-px py-2 text-center text-sm font-medium">
        {nav.announcement}
      </p>
    </div>
  );
}
