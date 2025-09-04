
function getLinkedInProfileData() {
  // Helper to get text content from an element, returns empty string if not found
  const getText = (context, selector) => {
    const el = context.querySelector(selector);
    return el ? el.innerText.trim() : '';
  };

  // Helper to find a section by its heading text and return its parent section element
  const findSectionElement = (headingText) => {
    const heading = Array.from(document.querySelectorAll('h2, h3, span')).find(el => el.innerText.includes(headingText));
    // Try to find the closest common parent that acts as a section container
    return heading ? heading.closest('section, div[data-test-id*="section"]') : null;
  };

  // --- Profile Header ---
  // More generic selectors for name and headline
  const name = getText(document, 'h1, .text-heading-xlarge, .pv-top-card--list__headline, .top-card-layout__title');
  console.log('LinkedIn Scraper: Name -', name);
  const headline = getText(document, '.pv-top-card--list__headline, .top-card-layout__headline, .text-body-medium');
  console.log('LinkedIn Scraper: Headline -', headline);
  const location = getText(document, '.pv-top-card--list__locality, .top-card-layout__locality, span.text-body-small.inline.t-black--light.break-words');
  console.log('LinkedIn Scraper: Location -', location);

  
  // --- About Section ---
  const aboutSection = findSectionElement('About');
  const about = aboutSection ? getText(aboutSection, '.pv-about__summary-text, div[data-test-id="about-section-text"], .inline-show-more-text') : '';
  console.log('LinkedIn Scraper: About -', about);
  
  // --- Experience Section ---
  const experienceSection = findSectionElement('Experience');
  const experience = [];
  if (experienceSection) {
    const experienceItems = Array.from(experienceSection.querySelectorAll('div[data-view-name="profile-component-entity"]'));
    for (const item of experienceItems) {
      const title = getText(item, 'span.t-bold[aria-hidden="true"]');
      const companyElement = item.querySelector('a > span.t-14.t-normal > span[aria-hidden="true"]');
      const company = companyElement ? companyElement.innerText.split(' · ')[0].trim() : '';
      
      // Dates and Duration
      const dateRangeElement = item.querySelector('span.t-14.t-normal.t-black--light span.pvs-entity__caption-wrapper[aria-hidden="true"]');
      const dateRangeText = dateRangeElement ? dateRangeElement.innerText.trim() : '';
      const [dates, duration] = dateRangeText.split(' · ').map(s => s.trim());

      // Location for this specific role
      const locationElement = item.querySelector('span.t-14.t-normal.t-black--light span[aria-hidden="true"]:not(.pvs-entity__caption-wrapper)');
      const roleLocation = locationElement ? locationElement.innerText.trim() : '';

      // Description/Bullet Points
      const descriptionElement = item.querySelector('div.inline-show-more-text--is-collapsed span[aria-hidden="true"]');
      const description = descriptionElement ? descriptionElement.innerText.trim() : '';

      experience.push({ title, company, dates, duration, roleLocation, description });
    }
  }
  console.log('LinkedIn Scraper: Experience -', experience);
  
  // --- Education Section ---
  const educationSection = findSectionElement('Education');
  const education = [];
  if (educationSection) {
    const educationItems = Array.from(educationSection.querySelectorAll('li.pvs-list__item, .education-item'));
    for (const item of educationItems) {
      education.push(item.innerText.trim());
    }
  }
  console.log('LinkedIn Scraper: Education -', education);
  
  return {
    name,
    headline,
    location,
    about,
    experience,
    education,
  };
}

