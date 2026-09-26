import { Shape } from "three";
import type { Pair } from "polygon-clipping";
import { flatFeetBottomEdge, flatFeetLayout } from "./flat-feet";
import type { SpeakerConfiguration, SpeakerPart } from "./speaker";

export function addSpeakerFeet(config: SpeakerConfiguration, parts: SpeakerPart[]) {
  const feet = flatFeetLayout({ ...config, angle: 0 });
  if (!feet.enabled) return feet;
  for (const side of parts.filter(p => p.id === "left" || p.id === "right")) {
    // Reuse the case's exact lower profiles, anchored at the exterior base.
    // The side extends past the base joint; the bottom nests between the sides.
    const baseY = -config.height/2-side.position[1];
    const topY = side.height/2, shape = new Shape();
    flatFeetBottomEdge(shape,side.width/100,side.thickness/100,feet);
    shape.lineTo(side.width/200,(topY-baseY)/100);
    shape.lineTo(-side.width/200,(topY-baseY)/100);
    shape.closePath();
    const centreY = (topY+baseY-feet.height)/2;
    side.polygons[0][0] = shape.getPoints(24).map(p => [p.x*100,p.y*100+baseY] as Pair);
    side.polygons = side.polygons.map(polygon => polygon.map(ring => ring.map(([x,y]) => [x,y-centreY] as Pair)));
    side.height = topY-baseY+feet.height;
    side.position[1] += centreY;
  }
  return feet;
}
