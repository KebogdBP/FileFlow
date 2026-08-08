import type { Metadata } from 'next';
import React from 'react';
import { GlassHome } from './glass-home';
import './workspace/workspace.css';
import './glass-home.css';

export const metadata: Metadata = {
  title: 'Convert, compress and manage files privately',
  description:
    'Convert images, video, audio, PDF and DOCX files in one private workspace. Process locally when possible, with clear cloud handling for heavier jobs.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'File Flow — private file tools in one workspace',
    description: 'Convert, compress, resize, merge and prepare files with clear privacy controls.',
    type: 'website',
    url: '/',
    siteName: 'File Flow',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: 'FileFlow subtitle extraction and AI answers workflow',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'File Flow — private file tools',
    description: 'One calm workspace for documents, images, video and audio.',
    images: ['/og.png'],
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'File Flow',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web',
  description:
    'Privacy-first web workspace for converting, compressing and preparing documents and media.',
  featureList: [
    'Image optimization',
    'Video and audio conversion',
    'PDF compression, splitting and merging',
    'DOCX to PDF conversion',
    'Public social video import',
    'Batch image and PDF processing',
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <GlassHome />
    </>
  );
}
