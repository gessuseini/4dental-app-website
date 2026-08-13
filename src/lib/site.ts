export const siteConfig = {
  name: "4Dental.app",
  domain: process.env.NEXT_PUBLIC_SITE_DOMAIN || "4dental.app",
  tagline: "Choose your product",
  intro:
    "Two apps under one brand — Clinic for dentists, Lab for technicians. Pick the one that fits your work.",
  description:
    "Enter 4Dental Clinic or 4Dental Lab — management software for dental clinics and laboratories.",
  logo: "/icon.png",
  clinic: {
    name: "4Dental Clinic",
    hubLabel: "Management Hub",
    description: "Clinic management software for dentists/clinics.",
    url: process.env.NEXT_PUBLIC_CLINIC_URL || "https://4dental.clinic",
    logo: "/clinic-logo.png",
  },
  lab: {
    name: "4Dental Lab",
    hubLabel: "Management Hub",
    description: "Lab management software for lab technicians/laboratories.",
    url: process.env.NEXT_PUBLIC_LAB_URL || "https://4dental-lab.com",
    logo: "/lab-logo.png",
  },
} as const;
