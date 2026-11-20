import { Image, Text } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { Brand } from './brand';

/** Logo of the practice in a PDF header, or its name as text (practice-settings) */
export function BrandMark({ brand, textStyle }: { brand: Brand; textStyle: Style }) {
  if (brand.logo)
    return (
      // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
      <Image src={{ data: brand.logo.data, format: brand.logo.type === 'image/png' ? 'png' : 'jpg' }} style={{ height: 32, maxWidth: 160, objectFit: 'contain', objectPosition: 'left' }} />
    );
  return <Text style={textStyle}>{brand.name}</Text>;
}
