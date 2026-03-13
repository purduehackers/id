/// <reference types="@sveltejs/kit" />

declare namespace App {
  interface Locals {
    session?: {
      token: string;
      ownerId: number;
    };
  }
}
