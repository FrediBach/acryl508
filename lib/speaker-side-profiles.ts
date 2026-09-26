import { Shape } from "three";
import type { Pair } from "polygon-clipping";
import { flatFeetLayout } from "./flat-feet";
import { createSideProfile } from "./acrylic-profiles";
import { sheetThickness } from "./sheet-materials";
import type { SpeakerConfiguration, SpeakerPart } from "./speaker";

export function speakerHandleSides(config: SpeakerConfiguration): ("left" | "right")[] {
  return !config.handle ? [] : config.handleMode === "pair" ? ["left", "right"] : [config.handleMode];
}

export function addSpeakerSideProfiles(config: SpeakerConfiguration, parts: SpeakerPart[]) {
  const feet = flatFeetLayout({ ...config, angle: 0 });
  const sides = speakerHandleSides(config);
  for (const side of parts.filter(p => p.id === "left" || p.id === "right")) {
    const handle = sides.some(id => id === side.id);
    if (!feet.enabled && !handle) continue;
    // Extend only the relevant butt joint: the top/base nests between the sides.
    const baseY = -config.height/2 + (feet.enabled ? 0 : sheetThickness(config,"bottom")) - side.position[1];
    const topY = config.height/2 - (handle ? 0 : sheetThickness(config,"top")) - side.position[1];
    const shape = createSideProfile(new Shape(),side.width/100,(topY-baseY)/100,side.thickness/100,0,"wedge",handle,
      {width:config.handleWidth/100,height:config.handleHeight/100},undefined,false,undefined,feet);
    const outline = shape.getPoints(24).map(p => [p.x*100,p.y*100+baseY] as Pair);
    const bottom = baseY-(feet.enabled ? feet.height : 0), top = topY+(handle ? config.handleHeight : 0);
    const centreY = (top+bottom)/2;
    side.polygons[0][0] = outline;
    side.polygons[0].push(...shape.holes.map(hole => hole.getPoints(24).map(p => [p.x*100,p.y*100+baseY] as Pair).reverse()));
    side.polygons = side.polygons.map(polygon => polygon.map(ring => ring.map(([x,y]) => [x,y-centreY] as Pair)));
    side.width = Math.max(...outline.map(([x])=>x))-Math.min(...outline.map(([x])=>x));
    side.height = top-bottom;
    side.position[1] += centreY;
  }
  return feet;
}
