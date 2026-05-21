import { IonButton, IonIcon } from "@ionic/react";
import { logoWhatsapp } from "ionicons/icons";
import { generateWhatsAppLink, formatPhoneForWhatsApp } from "@rapa-go/shared";

interface WhatsAppButtonProps {
  phone:    string;
  message:  string;
  label?:   string;
  size?:    "small" | "default" | "large";
  fill?:    "clear" | "outline" | "solid";
  color?:   string;
  expand?:  "block" | "full";
  style?:   React.CSSProperties;
}

export function WhatsAppButton({
  phone,
  message,
  label   = "WhatsApp",
  size    = "small",
  fill    = "outline",
  color   = "success",
  expand,
  style,
}: WhatsAppButtonProps): JSX.Element | null {
  const cleaned = formatPhoneForWhatsApp(phone);
  if (!cleaned || cleaned.length < 7) return null;

  const href = generateWhatsAppLink(phone, message);

  const extraProps: Record<string, unknown> = {};
  if (expand) extraProps["expand"] = expand;
  if (style)  extraProps["style"]  = style;

  return (
    <IonButton
      size={size}
      fill={fill}
      color={color}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...extraProps}
    >
      <IonIcon slot="start" icon={logoWhatsapp} />
      {label}
    </IonButton>
  );
}
