import GoogleMaps from "./components/GoogleMaps";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from "@vercel/analytics/react"

export default function Home() {
  return (
    <>
      <GoogleMaps/>
      <SpeedInsights/>
      <Analytics/>
    </>
  );
}
