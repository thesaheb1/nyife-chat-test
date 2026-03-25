import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WhatsAppFlow } from '@/core/types';
import { addCarouselCard, type CarouselCardDraft, type TemplateDraft } from './templateBuilder';
import {
  HeaderFields,
  SecurityRecommendationToggle,
  StandardButtonsEditor,
  VariableTextareaField,
} from './TemplateComposerHelpers';
import { TemplateOptionSelect } from './TemplateOptionSelect';
import { updateCarouselCard } from './templateComposerUtils';

function applyHeaderFormat<T extends { headerFormat: TemplateDraft['standard']['headerFormat']; headerText: string; headerMedia: TemplateDraft['standard']['headerMedia'] }>(
  current: T,
  next: TemplateDraft['standard']['headerFormat']
): T {
  return {
    ...current,
    headerFormat: next,
    headerText: next === 'TEXT' ? current.headerText : '',
    headerMedia: current.headerFormat === next ? current.headerMedia : null,
  };
}

function getFlowScreenOptions(flow: WhatsAppFlow | undefined) {
  return flow?.json_definition?.screens?.map((screen) => ({
    value: screen.id,
    label: `${screen.title} (${screen.id})`,
  })) || [];
}

export function StandardTemplateSection({
  draft,
  onChange,
}: {
  draft: TemplateDraft;
  onChange: (next: TemplateDraft) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Standard template builder</CardTitle>
        <CardDescription>Build text or media templates with optional footer and standard CTA buttons.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <HeaderFields
          headerFormat={draft.standard.headerFormat}
          headerText={draft.standard.headerText}
          headerMedia={draft.standard.headerMedia}
          onFormatChange={(value) => onChange({ ...draft, standard: applyHeaderFormat(draft.standard, value) })}
          onTextChange={(value) => onChange({ ...draft, standard: { ...draft.standard, headerText: value } })}
          onMediaChange={(value) => onChange({ ...draft, standard: { ...draft.standard, headerMedia: value } })}
        />
        <VariableTextareaField
          label="Body text"
          value={draft.standard.bodyText}
          onChange={(value) => onChange({ ...draft, standard: { ...draft.standard, bodyText: value } })}
          rows={6}
          placeholder="Hi {{1}}, your order is confirmed and will reach you by {{2}}."
        />
        <div className="space-y-2">
          <Label>Footer text</Label>
          <Input
            value={draft.standard.footerText}
            onChange={(event) => onChange({ ...draft, standard: { ...draft.standard, footerText: event.target.value } })}
            placeholder="Reply STOP to opt out"
          />
        </div>
        <StandardButtonsEditor
          buttons={draft.standard.buttons}
          maxButtons={10}
          label="Buttons"
          onChange={(buttons) => onChange({ ...draft, standard: { ...draft.standard, buttons } })}
        />
      </CardContent>
    </Card>
  );
}

export function AuthenticationTemplateSection({
  draft,
  onChange,
}: {
  draft: TemplateDraft;
  onChange: (next: TemplateDraft) => void;
}) {
  const usesAutofill = draft.authentication.otpType !== 'COPY_CODE';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication template builder</CardTitle>
        <CardDescription>Configure OTP delivery using the Meta authentication template structure.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl border bg-muted/10 p-4 text-sm text-muted-foreground">
          Meta authentication templates do not use custom body copy. WhatsApp renders the OTP message using the authentication template format.
        </div>
        <SecurityRecommendationToggle
          checked={draft.authentication.addSecurityRecommendation}
          onCheckedChange={(checked) => onChange({ ...draft, authentication: { ...draft.authentication, addSecurityRecommendation: checked } })}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Code expiration (minutes)</Label>
            <Input
              type="number"
              min={1}
              max={90}
              value={draft.authentication.codeExpirationMinutes}
              onChange={(event) =>
                onChange({
                  ...draft,
                  authentication: {
                    ...draft.authentication,
                    codeExpirationMinutes: event.target.value ? Number(event.target.value) : '',
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>OTP type</Label>
            <Select
              value={draft.authentication.otpType}
              onValueChange={(value) => onChange({ ...draft, authentication: { ...draft.authentication, otpType: value as TemplateDraft['authentication']['otpType'] } })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COPY_CODE">Copy code</SelectItem>
                <SelectItem value="ONE_TAP">One tap</SelectItem>
                <SelectItem value="ZERO_TAP">Zero tap</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Button text</Label>
            <Input
              value={draft.authentication.buttonText}
              onChange={(event) => onChange({ ...draft, authentication: { ...draft.authentication, buttonText: event.target.value } })}
              placeholder={usesAutofill ? 'Autofill code' : 'Copy code'}
            />
          </div>
          {usesAutofill ? (
            <div className="space-y-2">
              <Label>Autofill text</Label>
              <Input
                value={draft.authentication.autofillText}
                onChange={(event) => onChange({ ...draft, authentication: { ...draft.authentication, autofillText: event.target.value } })}
                placeholder="Autofill"
              />
            </div>
          ) : null}
        </div>
        {usesAutofill ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Android package name</Label>
              <Input
                value={draft.authentication.packageName}
                onChange={(event) => onChange({ ...draft, authentication: { ...draft.authentication, packageName: event.target.value } })}
                placeholder="com.example.app"
              />
            </div>
            <div className="space-y-2">
              <Label>Signature hash</Label>
              <Input
                value={draft.authentication.signatureHash}
                onChange={(event) => onChange({ ...draft, authentication: { ...draft.authentication, signatureHash: event.target.value } })}
                placeholder="K8a%2FAINcGX7"
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function FlowTemplateSection({
  draft,
  flows,
  onChange,
}: {
  draft: TemplateDraft;
  flows: WhatsAppFlow[];
  onChange: (next: TemplateDraft) => void;
}) {
  const selectedFlow = flows.find((flow) => flow.id === draft.flow.flow_id);
  const flowScreenOptions = getFlowScreenOptions(selectedFlow);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flow launch template builder</CardTitle>
        <CardDescription>Flow templates use only body text plus one CTA button linked to a WhatsApp Flow.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl border bg-muted/10 p-4 text-sm text-muted-foreground">
          Official Meta flow template examples do not include a header or footer. This dropdown shows flows available to the current organization.
        </div>
        <VariableTextareaField
          label="Body text"
          value={draft.flow.bodyText}
          onChange={(value) => onChange({ ...draft, flow: { ...draft.flow, bodyText: value } })}
          rows={6}
          placeholder="Complete the lead qualification flow to continue."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Button text</Label>
            <Input
              value={draft.flow.buttonText}
              onChange={(event) => onChange({ ...draft, flow: { ...draft.flow, buttonText: event.target.value } })}
              placeholder="Open flow"
            />
          </div>
          <div className="space-y-2">
            <Label>Form flow</Label>
            <TemplateOptionSelect
              value={draft.flow.flow_id || null}
              options={flows.map((flow) => ({
                value: flow.id,
                label: flow.name,
                description: `${flow.status} / ${flow.categories.join(', ')}`,
              }))}
              placeholder="Select Nyife flow"
              searchPlaceholder="Search saved WhatsApp flows"
              emptyMessage="No flows found for this organization yet."
              title="Select a WhatsApp flow"
              description="Search saved Nyife flows and choose the one this template button should open."
              onChange={(value) => {
                const flow = flows.find((item) => item.id === value);
                const firstScreen = flow?.json_definition?.screens?.[0]?.id || '';
                onChange({
                  ...draft,
                  flow: {
                    ...draft.flow,
                    flow_id: value,
                    flow_name: flow?.name || '',
                    navigate_screen: firstScreen,
                    flow_json: '',
                  },
                });
              }}
              disabled={flows.length === 0}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Flow action</Label>
            <Select value={draft.flow.flow_action} onValueChange={(value) => onChange({ ...draft, flow: { ...draft.flow, flow_action: value as TemplateDraft['flow']['flow_action'] } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="navigate">Navigate</SelectItem>
                <SelectItem value="data_exchange">Data exchange</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Navigate screen</Label>
            {flowScreenOptions.length ? (
              <Select value={draft.flow.navigate_screen || flowScreenOptions[0]?.value} onValueChange={(value) => onChange({ ...draft, flow: { ...draft.flow, navigate_screen: value } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {flowScreenOptions.map((screen) => (
                    <SelectItem key={screen.value} value={screen.value}>{screen.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={draft.flow.navigate_screen} onChange={(event) => onChange({ ...draft, flow: { ...draft.flow, navigate_screen: event.target.value } })} placeholder="FIRST_SCREEN" disabled />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ListMenuTemplateSection({
  draft,
  onChange,
}: {
  draft: TemplateDraft;
  onChange: (next: TemplateDraft) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>List menu template builder</CardTitle>
        <CardDescription>Create a commerce-entry template for catalog or multi-product message experiences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <HeaderFields
          headerFormat={draft.listMenu.headerFormat}
          headerText={draft.listMenu.headerText}
          headerMedia={draft.listMenu.headerMedia}
          onFormatChange={(value) => onChange({ ...draft, listMenu: applyHeaderFormat(draft.listMenu, value) })}
          onTextChange={(value) => onChange({ ...draft, listMenu: { ...draft.listMenu, headerText: value } })}
          onMediaChange={(value) => onChange({ ...draft, listMenu: { ...draft.listMenu, headerMedia: value } })}
        />
        <VariableTextareaField
          label="Body text"
          value={draft.listMenu.bodyText}
          onChange={(value) => onChange({ ...draft, listMenu: { ...draft.listMenu, bodyText: value } })}
          rows={6}
          placeholder="Browse our store and continue with the products that match your need."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Footer text</Label>
            <Input
              value={draft.listMenu.footerText}
              onChange={(event) => onChange({ ...draft, listMenu: { ...draft.listMenu, footerText: event.target.value } })}
              placeholder="Shop with confidence"
            />
          </div>
          <div className="space-y-2">
            <Label>Button type</Label>
            <Select
              value={draft.listMenu.buttonType}
              onValueChange={(value) => onChange({ ...draft, listMenu: { ...draft.listMenu, buttonType: value as TemplateDraft['listMenu']['buttonType'] } })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CATALOG">Catalog</SelectItem>
                <SelectItem value="MPM">Multi-product message</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Button text</Label>
            <Input
              value={draft.listMenu.buttonText}
              onChange={(event) => onChange({ ...draft, listMenu: { ...draft.listMenu, buttonText: event.target.value } })}
              placeholder="Browse catalog"
            />
          </div>
          <div className="space-y-2">
            <Label>Example</Label>
            <Input
              value={draft.listMenu.example}
              onChange={(event) => onChange({ ...draft, listMenu: { ...draft.listMenu, example: event.target.value } })}
              placeholder="Optional example payload"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CarouselTemplateSection({
  draft,
  onChange,
}: {
  draft: TemplateDraft;
  onChange: (next: TemplateDraft) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Carousel template builder</CardTitle>
        <CardDescription>Build 2 to 10 cards with their own media, copy, and CTA buttons.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-3 rounded-2xl border p-4">
          <div>
            <div className="font-semibold">Carousel cards</div>
            <p className="text-sm text-muted-foreground">Keep at least 2 cards for Meta approval and user clarity.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange({ ...draft, carousel: { cards: addCarouselCard(draft.carousel.cards) } })}
            disabled={draft.carousel.cards.length >= 10}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add card
          </Button>
        </div>
        <div className="space-y-4">
          {draft.carousel.cards.map((card, index) => (
            <div key={index} className="rounded-3xl border p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Card {index + 1}</div>
                  <div className="text-sm text-muted-foreground">Configure media, message copy, and card CTAs.</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    onChange({
                      ...draft,
                      carousel: {
                        cards:
                          draft.carousel.cards.length > 2
                            ? draft.carousel.cards.filter((_, cardIndex) => cardIndex !== index)
                            : draft.carousel.cards,
                      },
                    })
                  }
                  disabled={draft.carousel.cards.length <= 2}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <HeaderFields
                  headerFormat={card.headerFormat}
                  headerText={card.headerText}
                  headerMedia={card.headerMedia}
                  label={`Card ${index + 1} header`}
                  onFormatChange={(value) =>
                    onChange({
                      ...draft,
                      carousel: {
                        cards: updateCarouselCard(
                          draft.carousel.cards,
                          index,
                          applyHeaderFormat(card, value)
                        ),
                      },
                    })
                  }
                  onTextChange={(value) => onChange({ ...draft, carousel: { cards: updateCarouselCard(draft.carousel.cards, index, { headerText: value }) } })}
                  onMediaChange={(value) => onChange({ ...draft, carousel: { cards: updateCarouselCard(draft.carousel.cards, index, { headerMedia: value }) } })}
                />
                <VariableTextareaField
                  label="Card body text"
                  value={card.bodyText}
                  onChange={(value) =>
                    onChange({
                      ...draft,
                      carousel: { cards: updateCarouselCard(draft.carousel.cards, index, { bodyText: value }) },
                    })
                  }
                  rows={4}
                  placeholder="Highlight this offer, product, or step."
                />
                <div className="space-y-2">
                  <Label>Card footer text</Label>
                  <Input
                    value={card.footerText}
                    onChange={(event) => onChange({ ...draft, carousel: { cards: updateCarouselCard(draft.carousel.cards, index, { footerText: event.target.value }) } })}
                    placeholder="Limited-time offer"
                  />
                </div>
                <StandardButtonsEditor
                  buttons={card.buttons}
                  maxButtons={2}
                  label={`Card ${index + 1} buttons`}
                  onChange={(buttons) =>
                    onChange({
                      ...draft,
                      carousel: {
                        cards: updateCarouselCard(
                          draft.carousel.cards,
                          index,
                          { buttons } as Partial<CarouselCardDraft>
                        ),
                      },
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
