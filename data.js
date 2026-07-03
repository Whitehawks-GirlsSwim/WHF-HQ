/*
  WHF HQ CONTENT FILE
  Edit this file when information changes.
  Do not edit index.html or styles.css for routine updates.

  Common edits:
  - Change the latestUpdate title/body when there is a new announcement.
  - Add/change meetSchedule items when the meet schedule changes.
  - Add practiceSchedule items when you receive the practice schedule.
  - Add sponsors as they are confirmed.
  - Update teamStore status/windows as needed.
*/

window.WHF_DATA = {
  season: {
    label: '2026 SEASON',
    programName: 'WHF Girls Swim & Dive'
  },

  latestUpdate: {
    title: 'Meet schedule loaded',
    body: 'The 2026 meet schedule has been added. Practice information can be added once finalized.',
    updated: 'July 2026'
  },

  keyDates: [
    {
      date: '2026-08-17T07:00:00-05:00',
      title: 'Practice Begins',
      label: 'PRACTICE BEGINS',
      meta: 'Monday, August 17',
      location: 'Practice details can be updated once Coach Ben finalizes the schedule.'
    }
  ],

  meetSchedule: [
    { date: '2026-08-29T10:00:00-05:00', level: 'Junior Varsity', opponent: 'Tim Daly Invitational', location: 'Orono Intermediate School Educational Link Pool' },
    { date: '2026-08-29T10:00:00-05:00', level: 'Varsity', opponent: 'Tim Daly Invitational', location: 'Orono Intermediate School Educational Link Pool' },
    { date: '2026-09-10T18:00:00-05:00', level: 'Varsity', opponent: 'vs Dassel-Cokato', location: 'Westonka High School Westonka Activity Center Pool' },
    { date: '2026-09-17T18:00:00-05:00', level: 'Varsity', opponent: '@ Watertown-Mayer/ML/SWC', location: 'Watertown-Mayer High School' },
    { date: '2026-09-22T18:00:00-05:00', level: 'Varsity', opponent: 'vs Orono', location: 'Westonka High School Westonka Activity Center Pool' },
    { date: '2026-09-22T18:00:00-05:00', level: 'Junior Varsity', opponent: 'vs Orono', location: 'Westonka High School Westonka Activity Center Pool' },
    { date: '2026-09-24T18:00:00-05:00', level: 'Varsity', opponent: 'vs Litchfield', location: 'Litchfield High School' },
    { date: '2026-10-01T18:00:00-05:00', level: 'Varsity', opponent: 'vs Hutchinson', location: 'Westonka High School Westonka Activity Center Pool' },
    { date: '2026-10-08T18:00:00-05:00', level: 'Junior Varsity', opponent: '@ Delano', location: 'Delano High School Pool' },
    { date: '2026-10-08T18:00:00-05:00', level: 'Varsity', opponent: '@ Delano', location: 'Delano High School Pool' },
    { date: '2026-10-10T09:00:00-05:00', level: 'Varsity', opponent: 'True Team Sections', location: 'Willmar High School WHS Pool' },
    { date: '2026-10-17T12:00:00-05:00', level: 'Varsity', opponent: 'True Team State', location: 'University of Minnesota Jean K. Freeman Aquatic Center' },
    { date: '2026-10-22T09:00:00-05:00', level: 'Varsity', opponent: 'True Team Sections', location: 'Willmar High School WHS Pool' },
    { date: '2026-11-05T18:00:00-06:00', level: 'Varsity', opponent: 'Section Prelims', location: 'Hutchinson High School' },
    { date: '2026-11-07T12:00:00-06:00', level: 'Varsity', opponent: 'Section Finals', location: 'Hutchinson High School' },
    { date: '2026-11-12T12:00:00-06:00', level: 'Varsity', opponent: 'State Dive Prelims', location: 'Jean K. Freeman Aquatic Center - U of MN' },
    { date: '2026-11-13T12:00:00-06:00', level: 'Varsity', opponent: 'State Swim Prelims', location: 'Jean K. Freeman Aquatic Center - U of MN' },
    { date: '2026-11-14T12:00:00-06:00', level: 'Varsity', opponent: 'State Swim/Dive Finals', location: 'Jean K. Freeman Aquatic Center - U of MN' }
  ],

  practiceSchedule: [
    // Example format once you have practices:
    // { date: '2026-08-17T07:00:00-05:00', title: 'Practice', time: '7:00–9:00 AM', location: 'Westonka Activity Center Pool' }
  ],

  teamStore: {
    status: 'Open',
    vendor: 'Elsmore Swim Shop',
    windowOne: 'July 6 – July 12',
    windowTwo: 'July 27 – August 2',
    url: 'https://elsmoreswim.com/collections/mound-westonka-holy-family-hs-girls'
  },

  events: [
    {
      title: 'Hydration Station',
      date: 'July 16–18',
      detail: 'Spirit of the Lakes volunteer shifts and signup links.'
    },
    {
      title: 'Dunk Tank',
      date: 'Saturday, July 18',
      detail: '4:30–6:30 PM at Spirit of the Lakes.'
    }
  ],

  sponsors: [
    // Add confirmed sponsors here:
    // { name: 'Business Name', note: 'Gold Sponsor' }
  ]
};
