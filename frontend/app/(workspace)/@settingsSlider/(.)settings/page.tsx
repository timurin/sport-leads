import SettingsPage from "@/app/(workspace)/settings/page";
import { SettingsCardSlider } from "@/components/settings/settings-card-slider";

export default function SettingsSliderIntercept() {
  return (
    <SettingsCardSlider>
      <SettingsPage />
    </SettingsCardSlider>
  );
}
