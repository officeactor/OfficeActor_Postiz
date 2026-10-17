'use client';

// OfficeActor: OfficeActor's oA* mark instead of the Postiz logo, in the
// upstream logo's footprint (68px high), centered on the top bar.
import { OfficeActorMark } from '@gitroom/frontend/officeactor/officeactor.logo';

export const Logo = () => {
  return (
    <div className="mt-[12px] min-w-[60px] min-h-[56px] flex items-center justify-center">
      <OfficeActorMark />
    </div>
  );
};
