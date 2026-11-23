import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, ErrorState, Field, LoadingState, PermissionCard, Screen, Txt } from '../../src/components/ui';
import { lookupBarcode } from '../../src/services/nutrition';
import { useDraft } from '../../src/stores/draftStore';
import type { MealSlot } from '../../src/types/models';
import { gtinError } from '../../src/utils/validation';

type State = { kind: 'scanning' } | { kind: 'looking'; code: string } | { kind: 'notFound'; code: string } | { kind: 'error'; code: string };

export default function BarcodeScanner() {
  const params = useLocalSearchParams<{ slot?: MealSlot; date?: string; target?: 'log' | 'recipe' | 'photo'; via?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const [manual, setManual] = useState('');
  const locked = useRef(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const lookupManual = () => {
    const problem = gtinError(manual);
    if (problem) return setManualError(problem);
    void lookup(manual.replace(/\s/g, ''));
  };
  const setFood = useDraft((s) => s.setFood);
  const setTarget = useDraft((s) => s.setTarget);

  const lookup = async (code: string) => {
    setState({ kind: 'looking', code });
    try {
      const food = await lookupBarcode(code);
      if (!food) {
        setState({ kind: 'notFound', code });
        return;
      }
      setFood(food, params.slot ?? null);
      setTarget(params.target ?? 'log');
      router.replace({ pathname: '/nutrition/food', params: { slot: params.slot ?? 'snack', date: params.date ?? '', target: params.target ?? 'log', from: params.via === 'search' ? 'search' : '' } });
    } catch {
      setState({ kind: 'error', code });
    }
  };

  const onScan = (r: BarcodeScanningResult) => {
    if (locked.current) return;
    locked.current = true;
    void lookup(r.data);
  };

  const reset = () => {
    locked.current = false;
    setState({ kind: 'scanning' });
  };

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: 'Scan a barcode' }} />
      {!permission ? (
        <LoadingState />
      ) : !permission.granted ? (
        <PermissionCard
          icon="camera-outline"
          title="Camera for barcodes"
          why="Knivy uses the camera only to read product barcodes. No photos are saved."
          canAskAgain={permission.canAskAgain}
          denied={permission.status === 'denied'}
          onRequest={() => void requestPermission()}
        />
      ) : state.kind === 'scanning' ? (
        <View style={{ height: 320, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }} onBarcodeScanned={onScan} />
        </View>
      ) : null}

      {state.kind === 'looking' ? (
        <Card>
          <Txt variant="heading">Looking up {state.code}</Txt>
          <LoadingState />
        </Card>
      ) : null}
      {state.kind === 'notFound' ? (
        <Card>
          <View style={{ gap: 10 }}>
            <Txt variant="heading">Product not found</Txt>
            <Txt tone="muted">Barcode {state.code} isn’t in the food databases Knivy uses. You can add it yourself from the package label.</Txt>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button size="sm" label="Create this food" onPress={() => router.replace({ pathname: '/nutrition/custom-food', params: { barcode: state.code } })} />
              <Button size="sm" variant="secondary" label="Scan again" onPress={reset} />
            </View>
          </View>
        </Card>
      ) : null}
      {state.kind === 'error' ? <ErrorState message="The food database didn’t respond. Check your connection and try again." onRetry={() => void lookup(state.code)} /> : null}

      <Field
        label="Or type the barcode"
        value={manual}
        onChangeText={(v) => {
          setManual(v);
          setManualError(null);
        }}
        keyboardType="number-pad"
        returnKeyType="search"
        maxLength={14}
        hint="The 8 to 14 digits printed under the bars."
        error={manualError}
        onSubmitEditing={lookupManual}
      />
      <Button label="Look up" variant="secondary" onPress={lookupManual} />
      <Banner body="Barcode data comes from Open Food Facts, a public database. Check values against the package." />
    </Screen>
  );
}
