import GoogleMaps from "./components/GoogleMaps";
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function Home() {
  return (
    <body>
      <GoogleMaps/>
      <SpeedInsights />
    </body>
  );
}
