import type { Metadata } from 'next';
import { GlassInterfaceDemo } from './glass-interface-demo';
import './interface-demo.css';

export const metadata: Metadata = {
  title: 'Glass interface concept',
  description: 'A calm glass interface concept for the FileFlow workspace.',
};

export default function InterfaceDemoPage() {
  return <GlassInterfaceDemo />;
}
