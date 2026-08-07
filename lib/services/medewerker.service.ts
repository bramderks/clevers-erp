import { medewerkerRepository } from "@/lib/repositories/medewerker.repository";

export const medewerkerService = {
  async getAll() {
    return medewerkerRepository.findAll();
  },

  async getById(id: string) {
    return medewerkerRepository.findById(id);
  },
};