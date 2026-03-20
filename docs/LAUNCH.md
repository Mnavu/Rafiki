# Launch Checklist

This repo is now prepared for:

- Django backend deploy on Render
- Expo web admin deploy on Netlify
- Android APK rebuild against a public API URL

## 1. Deploy the backend

Use the blueprint file at [`render.yaml`](../render.yaml).

### Render

1. Push the repo to GitHub.
2. In Render, create a new Blueprint instance from the repo.
3. Render will create:
   - `eduassist-api` web service
   - `eduassist-db` Postgres database
4. After the first deploy, update these environment values in Render:
   - `DJANGO_ALLOWED_HOSTS`
     Example: `eduassist-api.onrender.com`
   - `DJANGO_CSRF_TRUSTED_ORIGINS`
     Example: `https://eduassist-admin.netlify.app`
   - `CORS_ALLOWED_ORIGINS`
     Example: `https://eduassist-admin.netlify.app`
5. Open the backend URL and verify:
   - `/admin/`
   - `/api/schema/`

## 2. Deploy the admin web app

Use the Netlify config at [`netlify.toml`](../netlify.toml).

### Netlify

1. Create a new site from Git.
2. Set the base directory to `frontend-v2`.
3. Netlify should pick up:
   - Build command: `npm run build:web`
   - Publish directory: `dist`
4. Add environment variable:
   - `EXPO_PUBLIC_API_URL=https://your-render-backend-url`
5. Deploy and verify the admin login page loads.

## 3. Point the local app to the public backend

Update [`frontend-v2/.env`](../frontend-v2/.env):

```env
EXPO_PUBLIC_API_URL=https://your-render-backend-url
```

Then restart Expo:

```powershell
cd frontend-v2
npx expo start -c
```

## 4. Build the final APK

The APK already built against a LAN IP should not be shared broadly.

Rebuild after the public API URL is live:

```powershell
cd frontend-v2
npx eas build -p android --profile preview
```

If you want a store-style release build later:

```powershell
cd frontend-v2
npx eas build -p android --profile production
```

## 5. Share the launch artifacts

- Admin web link: Netlify URL or your custom domain
- APK install link: EAS build artifact

## 6. Minimum release verification

Check these before sharing:

1. Admin web login works from a device outside your Wi-Fi.
2. Student login works from the APK on mobile data or a different network.
3. Finance, HOD approvals, unit registration, and class communities load from the public API.
4. File uploads and report downloads work from the deployed backend.
