export const siteConfig = {
  name: "4Dental",
  domain: process.env.NEXT_PUBLIC_SITE_DOMAIN || "4dental.app",
  tagline: "Choose your product",
  description:
    "Enter 4Dental Clinic or 4Dental Lab — management software for dental clinics and laboratories.",
  clinic: {
    name: "4Dental Clinic",
    hubLabel: "Management Hub",
    description: "Clinic management for dentists.",
    url: process.env.NEXT_PUBLIC_CLINIC_URL || "https://4dental.clinic",
    logo: "/clinic-logo.png",
  },
  lab: {
    name: "4Dental Lab",
    hubLabel: "Management Hub",
    description: "Lab management for dental laboratories.",
    url: process.env.NEXT_PUBLIC_LAB_URL || "https://4dental-lab.com",
    logo: "/lab-logo.png",
  },
} as const;
