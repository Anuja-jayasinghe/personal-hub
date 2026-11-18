import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app.config";

/** Name and icons when the hub is added to a phone's home screen (C90). Icons come from design/brand/icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appConfig.name,
    short_name: appConfig.shortName,
    description: appConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: appConfig.themeColors.dark,
    theme_color: appConfig.themeColors.dark,
    icons: [
      { src: "/brand/hub-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/hub-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
