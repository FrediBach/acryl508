import type { Pair } from "polygon-clipping";

export function speakerRoundedRect(x: number, y: number, width: number, height: number, radius = 0): Pair[] {
  if (!radius) return [[x-width/2,y-height/2],[x+width/2,y-height/2],[x+width/2,y+height/2],[x-width/2,y+height/2],[x-width/2,y-height/2]];
  const ring: Pair[] = [];
  for (let corner = 0; corner < 4; corner++) {
    const angle = corner * Math.PI / 2;
    const cx = x + (corner === 0 || corner === 3 ? 1 : -1) * (width/2-radius);
    const cy = y + (corner < 2 ? 1 : -1) * (height/2-radius);
    for (let i=0;i<=12;i++) ring.push([cx+radius*Math.cos(angle+i*Math.PI/24),cy+radius*Math.sin(angle+i*Math.PI/24)]);
  }
  ring.push([...ring[0]]); return ring;
}
