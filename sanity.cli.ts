import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'polcbwiw',
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  },
  studioHost: 'cambridge-radar',
  deployment: {appId: 'tkvjb28b45dtwtgwlhzv1gm6', autoUpdates: true},
})
