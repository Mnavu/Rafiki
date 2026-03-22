## EAS Update Commands

### One-time local install

```powershell
cd C:\Users\USER\Rafiki\frontend-v2
npm install
```

### One-time production rebuild after enabling OTA

```powershell
cd C:\Users\USER\Rafiki\frontend-v2
npx eas login
npx eas build -p android --profile production
```

Use that build as the first APK/AAB with OTA enabled. Older builds will not receive EAS updates.

### Publish a preview OTA update

```powershell
cd C:\Users\USER\Rafiki\frontend-v2
npx eas update --channel preview --message "Preview update" --environment preview
```

### Publish a production OTA update

```powershell
cd C:\Users\USER\Rafiki\frontend-v2
npx eas update --channel production --message "Production update" --environment production
```

### Important notes

- Set `EXPO_PUBLIC_API_URL` in EAS project environment variables for both `preview` and `production`.
- OTA updates are for JavaScript and assets only.
- If you add native packages, change Expo SDK, or change native app config, rebuild the app instead of using `eas update`.
