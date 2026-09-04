export interface LandingBackground {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  colors?: Array<string>;
  direction?: string;
  image?: string;
}

export interface LandingTestimonialContent {
  text: string;
  author: string;
}

export interface LandingImage {
  url: string;
  alt: string;
}

export interface LandingHeading {
  text: string;
  color: string;
  size: string;
}

export interface LandingButton {
  text: string;
  link: string;
  color: string;
  background: string;
}

export interface LandingLogos {
  type: 'logos';
  title: string;
  logos: LandingImage[];
}

export interface LandingUsers {
  user_uuid: string;
  name: string;
  description: string;
  image_url: string;
  username?: string;
}

export interface LandingPeople {
  type: 'people';
  title: string;
  people: LandingUsers[];
}

export interface LandingTextAndImageSection {
  type: 'text-and-image';
  title: string;
  text: string;
  flow: 'left' | 'right';
  image: LandingImage;
  buttons: LandingButton[];
}

export interface LandingCourse {
  course_uuid: string;
}

export interface LandingFeaturedCourses {
  type: 'featured-courses';
  // The editor persists UUID strings; object refs are retained for legacy configs.
  courses: Array<LandingCourse | string>;
  title: string;
}

export interface LandingHeroSection {
  type: 'hero';
  title: string;
  background: LandingBackground;
  heading: LandingHeading;
  subheading: LandingHeading;
  buttons: LandingButton[];
  illustration?: {
    image: LandingImage;
    position: 'left' | 'right';
    verticalAlign: 'top' | 'center' | 'bottom';
    size: 'small' | 'medium' | 'large';
  };
  contentAlign?: 'left' | 'center' | 'right';
}

export interface ShowcaseStat {
  value: string;
  label: string;
}

export interface ShowcaseFeature {
  icon: 'layers' | 'route' | 'practice' | 'progress';
  title: string;
  description: string;
}

export interface ShowcaseStep {
  number: string;
  title: string;
  description: string;
}

export interface ShowcaseOffer {
  eyebrow: string;
  heading: string;
  description: string;
  highlights: Array<string>;
  ctaLabel: string;
  ctaHref: string;
}

export interface LandingShowcase {
  type: 'showcase';
  greetingEyebrow: string;
  greetingHeading: string;
  greetingDescription: string;
  stats: Array<ShowcaseStat>;
  features: Array<ShowcaseFeature>;
  steps: Array<ShowcaseStep>;
  offer: ShowcaseOffer;
  courseIds: Array<string>;
  coursesTitle: string;
  coursesDescription: string;
}

export type LandingSection = LandingTextAndImageSection | LandingHeroSection | LandingLogos | LandingPeople | LandingFeaturedCourses | LandingShowcase;

export interface LandingObject {
  sections: LandingSection[];
  enabled?: boolean;
}
